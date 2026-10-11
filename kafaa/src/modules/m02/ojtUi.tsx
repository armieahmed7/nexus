// F38 shared UI (W5 · E1): readiness ring, mode chip, the practice-entry form (bottom sheet on phones), the data hook and the
// "practice, not a sign-off" notice used by /my/ojt and /team/ojt.
import { useEffect, useState } from 'react';
import { Callout, Modal, ProgressRing, RadioGroup, SelectField, StatusPill, TextArea, TextField } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { useSession } from '../../auth/session';
import { OJT_MODES, OJT_RULES, PRACTICE_METHODS, addDays, myStandards, newClientKey, readiness, type LogInput, type LogRow, type Readiness } from './ojt';
import type { PreceptorCard } from './backend/rpc';
import { cachePreceptors, cachedPreceptors } from './ojtQueue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export function PracticeNotice() {
  const t = useT();
  return <Callout tone="sim" title={t('m02.ojt.noticeTitle')}>{t('m02.ojt.notice')}</Callout>;
}
export function ModeChip({ mode }: { mode: string }) {
  const t = useT();
  return <span className={`chip ${mode === 'perform' ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line text-ink-2'}`} data-mode={mode}>{t(`m02.ojt.mode.${mode}`)}</span>;
}
export function LogStatus({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={status === 'acknowledged' ? 'ok' : status === 'returned' ? 'bad' : 'info'} status={status}>{t(`m02.ojt.status.${status}`)}</StatusPill>;
}
export function ReadyRing({ r, size = 52 }: { r: Readiness; size?: number }) {
  const t = useT();
  const f = useFormat();
  return (
    <span className="inline-flex items-center gap-2" data-testid="m02-ojt-ready" data-ready={r.ready ? 'yes' : 'no'}>
      <ProgressRing value={(100 * Math.min(r.supervised, r.needed)) / r.needed} size={size} tone={r.ready ? 'ok' : 'accent'} label={<span dir="ltr">{f.num(Math.min(r.supervised, r.needed))}/{f.num(r.needed)}</span>} />
      <span className="text-[12px] leading-tight text-ink-3">{t('m02.ojt.supervised')}<br />{r.ready ? <span className="font-semibold text-ok">{t('m02.ojt.readyYes')}</span> : r.preceptor_ready ? t('m02.ojt.readyPreceptor') : t('m02.ojt.readyNo')}</span>
    </span>
  );
}

export interface OjtData {
  today: string;
  me: string;
  person: Row | null;
  standards: Row[];
  tasks: Row[];
  quals: Row[];
  logs: LogRow[];
  requests: Row[];
}
/** My standards and practisable tasks, all logbook entries and requests I can read (RLS), my qualification records. */
export function useOjtData(me: string | null) {
  const repo = useRepo();
  return useQuery(['ojt_logs', 'ojt_eval_requests', 'qual_records', 'task_items', 'qual_standards', 'evaluations'], async (): Promise<OjtData> => {
    const [people, standards, tasks, quals, logs, requests] = await Promise.all([
      repo.list('people', { filter: { id: me ?? '' } }), repo.list('qual_standards', { order: [['code', 'asc']] }), repo.list('task_items', { order: [['sort', 'asc']] }),
      repo.list('qual_records', { filter: { person_id: me ?? '' } }), repo.list('ojt_logs', { order: [['on_date', 'desc']] }), repo.list('ojt_eval_requests', { order: [['requested_at', 'desc']] }),
    ]);
    return { today: todayIso(), me: me ?? '', person: people[0] ?? null, standards, tasks, quals, logs: logs as unknown as LogRow[], requests };
  }, [me]);
}
/** The standards and tasks I may practise (never security-restricted, never classroom or written items). */
export function myTasks(d: OjtData) {
  const mine = myStandards(d.person ?? undefined, d.quals, d.standards);
  const stds = d.standards.filter((s) => mine.has(s.id) && !s.security_restricted && s.status === 'current');
  return stds.map((s) => ({ std: s, tasks: d.tasks.filter((t) => t.standard_id === s.id && (PRACTICE_METHODS as readonly string[]).includes(t.method)) })).filter((x) => x.tasks.length);
}
export const readinessFor = (d: OjtData, person: string, task: Row) => readiness(task, d.logs.filter((l) => l.person_id === person));

/** The practice-entry form. Online: sent at once; offline (or a network failure): queued on the device with its client key. */
export function LogPracticeModal({ task, std, onClose, onSubmit }: { task: Row; std: Row; onClose: () => void; onSubmit: (input: LogInput) => Promise<boolean> }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const me = useSession().identity.personId ?? 'me';
  const today = todayIso();
  const [pre, setPre] = useState<PreceptorCard[] | null>(null);
  const [x, setX] = useState({ on_date: today, mode: 'perform', preceptor: '', confidence: '3', conditions: '', note: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Offline the RPC cannot run: use the list kept on this device when the logbook was last open online (W5 QA).
    let live = true;
    const cached = cachedPreceptors<PreceptorCard>(me, task.id);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setPre(cached ?? []); return () => { live = false; }; }
    repo.rpc.ojtPreceptors(task.id).then((r) => { if (r.length) cachePreceptors(me, task.id, r); if (live) setPre(r.length ? r : cached ?? r); }, () => live && setPre(cached ?? []));
    return () => { live = false; };
  }, [repo, task.id, me]);
  const set = (k: string) => (v: string) => setX((p) => ({ ...p, [k]: v }));
  const valid = !!x.preceptor && x.on_date <= today && x.on_date >= addDays(today, -OJT_RULES.backdateDays) && x.note.length <= OJT_RULES.noteMax;
  const submit = async () => {
    setBusy(true);
    const ok = await onSubmit({ client_key: newClientKey(me), task_id: task.id, on_date: x.on_date, mode: x.mode as LogInput['mode'], preceptor_person_id: x.preceptor, confidence: Number(x.confidence), conditions: x.conditions || null, note: x.note || null });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title={<span><span className="num">{task.code}</span> · {t('m02.ojt.logTitle')}</span>}
      footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" disabled={!valid || busy} onClick={submit} data-testid="m02-ojt-submit">{t('m02.ojt.save')}</button></div>}>
      <div className="space-y-3" data-testid="m02-ojt-form">
        <p className="text-[13px] text-ink-2">{pick(task, 'statement')} <span className="text-ink-3">· {std.code}</span></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label={t('m02.ojt.date')} name="on_date" type="date" value={x.on_date} onChange={set('on_date')} hint={t('m02.ojt.dateHint')} />
          <SelectField label={t('m02.ojt.preceptor')} name="preceptor" value={x.preceptor} onChange={set('preceptor')} placeholder={pre ? (pre.length ? t('m02.ojt.choosePreceptor') : t('m02.ojt.noPreceptor')) : t('common.working')}
            options={(pre ?? []).map((p) => ({ value: p.id, label: `${pick(p, 'name')}${p.same_team ? ` · ${t('m02.ojt.sameTeam')}` : ''}${p.evaluator ? ` · ${t('m02.ojt.evaluator')}` : ''}` }))} hint={t('m02.ojt.preceptorHint')} />
        </div>
        <RadioGroup label={t('m02.ojt.conditions')} name="mode" value={x.mode} onChange={set('mode')} options={OJT_MODES.map((m) => ({ value: m, label: <span><strong>{t(`m02.ojt.mode.${m}`)}</strong> <span className="text-ink-3">· {t(`m02.ojt.modeHint.${m}`)}</span></span> }))} />
        <RadioGroup label={t('m02.ojt.confidence')} name="confidence" value={x.confidence} onChange={set('confidence')} options={['1', '2', '3', '4', '5'].map((c) => ({ value: c, label: t(`m02.ojt.conf.${c}`) }))} />
        <TextField label={t('m02.ojt.where')} name="conditions" value={x.conditions} onChange={set('conditions')} hint={t('m02.ojt.whereHint')} />
        <TextArea label={t('m02.ojt.note')} name="note" value={x.note} onChange={set('note')} rows={3} hint={t('m02.ojt.noteHint')} />
      </div>
    </Modal>
  );
}

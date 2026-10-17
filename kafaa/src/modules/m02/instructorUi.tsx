// F31 shared UI (M02 · W4E5): data hook, stage stepper, pills, currency card, requirements checklist, observation list and form,
// hours chart and log form, nomination form and the sourced programme facts. Pages never import backend/*.
import { useMemo, useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useFormat, usePick, useT, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { qualView, todayIso } from '../../domain/rules';
import {
  BarChart, Callout, Card, ConfirmDialog, EmptyState, Icon, Modal, ProgressBar, SelectField, SourceLink, StatusPill, Stepper, TextArea, TextField, type PillTone,
} from '../../ui';
import {
  INS_RULES, OBS_ITEMS, OBS_KEYS, RATINGS, STAGES, coTeachPair, currencyView, deriveStage, initialDoneOn, monthlyHours, nextObservation, qualifyingSet, scoreObservation,
  type CurrencyView, type ObsKind, type ObsRow, type Stage,
} from './instructors';

export type Track = RowOf<'instructor_tracks'>;
export type Obs = RowOf<'instructor_observations'>;
export type Hours = RowOf<'teaching_hours'>;
export interface TrackView {
  track: Track;
  stage: Stage;
  obs: Obs[];
  hours: Hours[];
  initialDone: string | null;
  currency: CurrencyView | null;
  coPair: [ObsRow, ObsRow] | null;
  qualSet: { co: [ObsRow, ObsRow]; solo: ObsRow } | null;
  next: ObsKind | null;
}

const INS_TABLES = ['instructor_tracks', 'instructor_observations', 'teaching_hours', 'qual_standards', 'courses', 'training_records', 'sessions'] as const;

/** Everything the F31 pages need, filtered by RLS (own rows, scope, or the whole pool for sat R/W/A). */
export function useInsData() {
  const repo = useRepo();
  return useQuery([...INS_TABLES], async () => {
    const [tracks, obs, hours, stds, courses, records, sessions] = await Promise.all([
      repo.list('instructor_tracks'),
      repo.list('instructor_observations'),
      repo.list('teaching_hours'),
      repo.list('qual_standards').catch(() => [] as RowOf<'qual_standards'>[]),
      repo.list('courses').catch(() => [] as RowOf<'courses'>[]),
      repo.list('training_records').catch(() => [] as RowOf<'training_records'>[]),
      repo.list('sessions').catch(() => [] as RowOf<'sessions'>[]),
    ]);
    const today = todayIso();
    const views = new Map<string, TrackView>();
    for (const t of tracks) {
      const o = obs.filter((x) => x.track_id === t.id).sort((a, b) => (a.observed_on < b.observed_on ? -1 : a.observed_on > b.observed_on ? 1 : a.id < b.id ? -1 : 1));
      const h = hours.filter((x) => x.person_id === t.person_id).sort((a, b) => (a.delivered_on < b.delivered_on ? 1 : -1));
      const init = t.initial_done_on ?? initialDoneOn(t.person_id, t.route, records as never);
      const stage = deriveStage(t as never, o as ObsRow[], init);
      views.set(t.id, {
        track: t, stage, obs: o, hours: h, initialDone: init, currency: currencyView(t as never, h as never, today),
        coPair: coTeachPair(o as ObsRow[]), qualSet: qualifyingSet(o as ObsRow[]), next: nextObservation(stage, t.status),
      });
    }
    return { tracks, obs, hours, stds, courses, sessions, views, stdById: new Map(stds.map((s) => [s.id, s])), courseById: new Map(courses.map((c) => [c.id, c])), today };
  });
}
export type InsData = NonNullable<ReturnType<typeof useInsData>['data']>;

export function useNamePick() {
  const pick = usePick();
  return (en: string | null | undefined, ar: string | null | undefined) => pick({ name_en: en ?? '', name_ar: ar || en || '' }, 'name');
}

// ───────────── pills and chips
const STAGE_TONE: Record<string, PillTone> = { nominated: 'neutral', initial_training: 'info', co_teach: 'info', solo: 'info', ready: 'accent', qualified: 'ok' };
export function StagePill({ v }: { v: TrackView }) {
  const t = useT();
  if (v.track.status === 'declined' || v.track.status === 'withdrawn') return <StatusPill tone="neutral">{t(`m02.ins.status.${v.track.status}`)}</StatusPill>;
  if (v.track.status === 'lapsed') return <StatusPill tone="bad">{t('m02.ins.currency.lapsed')}</StatusPill>;
  return <StatusPill tone={STAGE_TONE[v.stage] ?? 'neutral'}>{t(`m02.ins.stage.${v.stage}`)}</StatusPill>;
}
const CUR_TONE: Record<string, PillTone> = { current: 'ok', due: 'sim', at_risk: 'bad', lapsed: 'bad' };
export function CurrencyPill({ c }: { c: CurrencyView | null }) {
  const t = useT();
  if (!c) return <span className="text-ink-3">—</span>;
  return <StatusPill tone={CUR_TONE[c.status]}>{t(`m02.ins.currency.${c.status}`)}</StatusPill>;
}
export function RouteChip({ route }: { route: string }) {
  const t = useT();
  return <span className={`chip ${route === 'asip' ? 'border-accent/40 bg-accent/10 text-eyebrow' : 'border-line bg-sunken text-ink-2'}`}>{t(`m02.ins.route.${route}`)}</span>;
}
export function NoticeChip({ c }: { c: CurrencyView | null }) {
  const t = useT();
  if (!c?.notice) return null;
  return <span className={`chip ${c.notice === 30 ? 'border-bad-line bg-bad-bg text-bad' : 'border-sim-line bg-sim-bg text-sim'}`} data-testid="m02-ins-notice">{t('m02.ins.currency.notice', { n: c.notice })}</span>;
}
export function StdChips({ ids, d }: { ids: string[]; d: InsData }) {
  const pick = usePick();
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map((id) => { const s = d.stdById.get(id); return <span key={id} className="chip border-line bg-sunken text-ink-2" title={s ? pick(s, 'title') : id}>{s?.code ?? id}</span>; })}
    </span>
  );
}

// ───────────── stepper and requirements
export function StageStepper({ v }: { v: TrackView }) {
  const t = useT();
  const closed = v.track.status === 'declined' || v.track.status === 'withdrawn';
  const idx = STAGES.indexOf(v.stage);
  return <Stepper steps={STAGES.map((s) => ({ id: s, label: t(`m02.ins.stage.${s}`) }))} current={v.track.status === 'qualified' || v.track.status === 'lapsed' ? STAGES.length : idx} failedAt={closed ? idx : undefined} />;
}

function Req({ done, title, detail, testId }: { done: boolean; title: ReactNode; detail?: ReactNode; testId?: string }) {
  return (
    <li className="flex items-start gap-2" data-testid={testId} data-done={done ? 'yes' : 'no'}>
      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? 'bg-ok-bg text-ok' : 'bg-sunken text-ink-3'}`} aria-hidden><Icon name={done ? 'check' : 'calendar'} size={12} /></span>
      <div className="min-w-0"><div className="text-[13.5px] font-semibold">{title}</div>{detail && <div className="text-[12.5px] text-ink-2">{detail}</div>}</div>
    </li>
  );
}
/** The card's rules as a checklist: acceptance, initial course, two co-teach by different observers, a solo by a third, qualification. */
export function Requirements({ v, d }: { v: TrackView; d: InsData }) {
  const t = useT();
  const f = useFormat();
  const nm = useNamePick();
  const course = d.courseById.get(v.track.route === 'asip' ? 'c-asip' : 'c-instr');
  const obsLine = (o: ObsRow | undefined) => (o ? t('m02.ins.req.byOn', { name: nm(o.observer_name, o.observer_name_ar), date: f.date(o.observed_on), score: f.num(o.score) }) : undefined);
  const pair = v.qualSet?.co ?? v.coPair;
  return (
    <ul className="space-y-3" data-testid="m02-ins-requirements">
      <Req done={!!v.track.accepted_on} title={t('m02.ins.req.accepted')} detail={v.track.accepted_on ? f.date(v.track.accepted_on) : t('m02.ins.req.acceptedWait')} />
      <Req done={!!v.initialDone} title={t('m02.ins.req.initial', { code: course?.code ?? (v.track.route === 'asip' ? 'ASIP-101' : 'INSTR-101') })} detail={v.initialDone ? f.date(v.initialDone) : t('m02.ins.req.initialWait')} />
      <Req done={!!pair} title={t('m02.ins.req.coTeach')} detail={pair ? `${obsLine(pair[0])} · ${obsLine(pair[1])}` : t('m02.ins.req.coTeachWait', { n: f.num(v.obs.filter((o) => o.kind === 'co_teach' && o.result === 'pass').length) })} testId="m02-ins-req-coteach" />
      <Req done={!!v.qualSet} title={t('m02.ins.req.solo')} detail={v.qualSet ? obsLine(v.qualSet.solo) : t('m02.ins.req.soloWait')} testId="m02-ins-req-solo" />
      <Req done={v.track.status === 'qualified' || v.track.status === 'lapsed'} title={t('m02.ins.req.qualified')} detail={v.track.qualified_on ? t('m02.ins.req.qualifiedOn', { date: f.date(v.track.qualified_on) }) : t('m02.ins.req.qualifiedWait')} />
    </ul>
  );
}

// ───────────── currency
export function CurrencyCard({ v }: { v: TrackView }) {
  const t = useT();
  const f = useFormat();
  const c = v.currency;
  if (!c) return null;
  // the 90/60/30-day notice band of the shared qualification rule (qualView) for the currency due date
  const band = c.status === 'lapsed' ? null : qualView({ status: 'qualified', expires_on: c.due }).notice;
  return (
    <Card title={t('m02.ins.currency.title')} actions={<CurrencyPill c={c} />}>
      <div className="space-y-3" data-testid="m02-ins-currency">
        <div className="text-[13px] text-ink-2">
          {c.status === 'lapsed' ? t('m02.ins.currency.lapsedOn', { date: f.date(c.lapsed_on) }) : t('m02.ins.currency.dueOn', { date: f.date(c.due), days: f.num(c.days) })}
          {band && !c.met && <span className="ms-2"><NoticeChip c={c} /></span>}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[12.5px]"><span>{t('m02.ins.currency.delivery')}</span><span className="font-semibold" dir="ltr">{f.num(c.hours)} / {f.num(INS_RULES.minDeliveryHours)} h</span></div>
          <ProgressBar value={(c.hours / INS_RULES.minDeliveryHours) * 100} tone={c.hours >= INS_RULES.minDeliveryHours ? 'ok' : c.status === 'at_risk' || c.status === 'lapsed' ? 'bad' : 'accent'} label={t('m02.ins.currency.delivery')} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[12.5px]"><span>{t('m02.ins.currency.cpd')}</span><span className="font-semibold" dir="ltr">{f.num(c.cpd)} / {f.num(INS_RULES.minCpdHours)} h</span></div>
          <ProgressBar value={(c.cpd / INS_RULES.minCpdHours) * 100} tone={c.cpd >= INS_RULES.minCpdHours ? 'ok' : 'accent'} label={t('m02.ins.currency.cpd')} />
        </div>
        <p className="text-[12px] text-ink-3">{t('m02.ins.currency.window', { from: f.date(c.window_start), to: f.date(c.due), renewals: f.num(c.renewals) })}</p>
        <p className="text-[12px] text-ink-3">{t('m02.ins.currency.rule')}</p>
      </div>
    </Card>
  );
}

// ───────────── observations
const RESULT_TONE: Record<string, PillTone> = { pass: 'ok', fail: 'bad' };
export function ObservationList({ obs }: { obs: Obs[] }) {
  const t = useT();
  const f = useFormat();
  const nm = useNamePick();
  const pick = usePick();
  if (!obs.length) return <EmptyState icon="search" title={t('m02.ins.obs.none')} />;
  return (
    <ol className="space-y-3" data-testid="m02-ins-observations">
      {[...obs].reverse().map((o) => {
        const items = (o.items as { key: string; rating: string }[]) ?? [];
        return (
          <li key={o.id} className="rounded-card border border-line p-3" data-testid="m02-ins-observation">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip border-line bg-sunken text-ink-2">{t(`m02.ins.obs.kind.${o.kind}`)}</span>
                <StatusPill tone={RESULT_TONE[o.result]}>{t(`m02.ins.obs.result.${o.result}`)}</StatusPill>
                <span className="text-[12.5px] text-ink-3">{t('m02.ins.obs.by', { name: nm(o.observer_name, o.observer_name_ar), date: f.date(o.observed_on) })}</span>
              </div>
              <span className="text-[15px] font-semibold" dir="ltr">{f.num(o.score)}%</span>
            </div>
            <div className="mt-2"><ProgressBar value={o.score} tone={o.result === 'pass' ? 'ok' : 'bad'} label={t('m02.ins.obs.score')} /></div>
            {o.note && <p className="mt-2 text-[13px] text-ink-2">“{o.note}”</p>}
            <details className="mt-2">
              <summary className="cursor-pointer text-[12.5px] text-accent">{t('m02.ins.obs.items')}</summary>
              <ul className="mt-2 space-y-1">
                {OBS_ITEMS.map((it) => {
                  const r = items.find((x) => x.key === it.key)?.rating ?? 'not_met';
                  return (
                    <li key={it.key} className="flex items-start justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0">{pick({ text_en: it.en, text_ar: it.ar }, 'text')}{it.critical && <span className="ms-1 text-bad" aria-label={t('m02.ins.form.critical')}>*</span>}</span>
                      <span className={r === 'met' ? 'text-ok' : r === 'partly' ? 'text-sim' : 'text-bad'}>{t(`m02.ins.rating.${r}`)}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

/** Record an observation (instructors): checklist rated met / partly / not met with a live score, then a confirmation. */
export function ObservationModal({ v, d, open, onClose }: { v: TrackView; d: InsData; open: boolean; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const kinds: ObsKind[] = v.track.status === 'qualified' || v.track.status === 'lapsed' ? ['currency'] : v.stage === 'solo' ? ['solo', 'co_teach'] : ['co_teach', 'solo'];
  const [kind, setKind] = useState<ObsKind>(v.next ?? kinds[0]);
  const [date, setDate] = useState(todayIso());
  const [session, setSession] = useState('');
  const [note, setNote] = useState('');
  const [ratings, setRatings] = useState<Record<string, string>>(() => Object.fromEntries(OBS_KEYS.map((k) => [k, 'met'])));
  const [confirm, setConfirm] = useState(false);
  const items = OBS_KEYS.map((k) => ({ key: k, rating: ratings[k] }));
  const sc = scoreObservation(items);
  const sessions = useMemo(() => d.sessions.filter((s) => s.starts_at.slice(0, 10) <= todayIso()).sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1)).slice(0, 30), [d.sessions]);
  const itemText = (it: (typeof OBS_ITEMS)[number]) => pick({ text_en: it.en, text_ar: it.ar }, 'text');
  return (
    <>
      <Modal open={open && !confirm} onClose={onClose} size="lg" title={t('m02.ins.form.title')}
        footer={<div className="flex items-center justify-between gap-3"><span className="text-[13px]" data-testid="m02-ins-form-score">{t('m02.ins.form.preview', { score: f.num(sc.score) })} <StatusPill tone={RESULT_TONE[sc.result]}>{t(`m02.ins.obs.result.${sc.result}`)}</StatusPill></span>
          <div className="flex gap-2"><button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary btn-sm" data-testid="m02-ins-form-submit" onClick={() => setConfirm(true)}>{t('m02.ins.form.submit')}</button></div></div>}>
        <div className="space-y-4" data-testid="m02-ins-form">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField name="ins-f234" label={t('m02.ins.form.kind')} value={kind} onChange={(x) => setKind(x as ObsKind)} options={kinds.map((k) => ({ value: k, label: t(`m02.ins.obs.kind.${k}`) }))} />
            <TextField name="ins-date" label={t('m02.ins.form.date')} type="date" value={date} onChange={setDate} />
            <SelectField name="ins-f236" label={t('m02.ins.form.session')} value={session} onChange={setSession} placeholder={t('m02.ins.form.noSession')}
              options={sessions.map((s) => ({ value: s.id, label: `${d.courseById.get(s.course_id)?.code ?? s.course_id} · ${f.date(s.starts_at)}` }))} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[13px] font-semibold">{t('m02.ins.form.checklist')}</legend>
            {OBS_ITEMS.map((it) => (
              <div key={it.key} className="flex flex-col gap-2 rounded-btn bg-sunken/60 p-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 text-[13px]">{itemText(it)}{it.critical && <span className="ms-1 chip border-bad-line bg-bad-bg text-bad">{t('m02.ins.form.critical')}</span>}</span>
                <span className="flex shrink-0 gap-1" role="radiogroup" aria-label={itemText(it)}>
                  {RATINGS.map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={ratings[it.key] === r} data-testid={`m02-ins-rate-${it.key}-${r}`}
                      className={`btn-sm ${ratings[it.key] === r ? (r === 'met' ? 'btn-primary' : r === 'partly' ? 'btn-outline border-sim text-sim' : 'btn-outline border-bad text-bad') : 'btn-ghost'}`}
                      onClick={() => setRatings((x) => ({ ...x, [it.key]: r }))}>{t(`m02.ins.rating.${r}`)}</button>
                  ))}
                </span>
              </div>
            ))}
          </fieldset>
          <TextArea name="ins-note" label={t('m02.ins.form.note')} value={note} onChange={setNote} rows={3} />
          <Callout tone="info">{t('m02.ins.form.rule')}</Callout>
        </div>
      </Modal>
      <ConfirmDialog open={open && confirm} onClose={() => setConfirm(false)} title={t('m02.ins.form.confirmTitle')} actingAs={t('m02.ins.asInstructor')}
        consequence={t('m02.ins.form.confirmBody', { kind: t(`m02.ins.obs.kind.${kind}`), score: f.num(sc.score), result: t(`m02.ins.obs.result.${sc.result}`) })}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.recordInstructorObservation({ track_id: v.track.id, kind, observed_on: date, items, session_id: session || null, course_id: session ? (d.sessions.find((s) => s.id === session)?.course_id ?? null) : null, note: note.trim() || null }));
          setConfirm(false);
          if (r.ok) onClose();
        }} />
    </>
  );
}

// ───────────── hours
export function HoursChart({ hours, today }: { hours: Hours[]; today: string }) {
  const t = useT();
  const f = useFormat();
  const m = monthlyHours(hours as never, today);
  return <BarChart title={t('m02.ins.hours.chart')} unit=" h" data={m.map((x) => ({ label: f.date(`${x.month}-01`, 'short').replace(/^\d+\s/, ''), value: x.delivery }))} target={Math.round((INS_RULES.minDeliveryHours / 12) * 10) / 10} />;
}

export function LogHoursModal({ personId, cpdOnly, open, onClose, d }: { personId: string; cpdOnly: boolean; open: boolean; onClose: () => void; d: InsData }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [kind, setKind] = useState(cpdOnly ? 'cpd' : 'delivery');
  const [hours, setHours] = useState('2');
  const [date, setDate] = useState(todayIso());
  const [course, setCourse] = useState('');
  const [note, setNote] = useState('');
  const pick = usePick();
  return (
    <ConfirmDialog open={open} onClose={onClose} title={t('m02.ins.hours.logTitle')} consequence={t(cpdOnly ? 'm02.ins.hours.logBodySelf' : 'm02.ins.hours.logBody')} actingAs={cpdOnly ? undefined : t('m02.ins.asTm')}
      onConfirm={async () => { await run(() => repo.rpc.logTeachingHours({ person_id: personId, kind, hours: Number(hours), delivered_on: date, course_id: course || null, note: note.trim() || null })); }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="m02-ins-hours-form">
        <SelectField name="ins-f291" label={t('m02.ins.hours.kind')} value={kind} onChange={setKind} options={(cpdOnly ? ['cpd'] : ['delivery', 'cpd']).map((k) => ({ value: k, label: t(`m02.ins.hours.kinds.${k}`) }))} />
        <TextField name="ins-hours" label={t('m02.ins.hours.hours')} type="number" value={hours} onChange={setHours} />
        <TextField name="ins-date" label={t('m02.ins.hours.date')} type="date" value={date} onChange={setDate} />
        <SelectField name="ins-f294" label={t('m02.ins.hours.course')} value={course} onChange={setCourse} placeholder={t('m02.ins.hours.noCourse')} options={d.courses.filter((c) => c.audience === 'staff').map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'title')}` }))} />
        <div className="sm:col-span-2"><TextArea name="ins-note" label={t('m02.ins.hours.note')} value={note} onChange={setNote} rows={2} /></div>
      </div>
    </ConfirmDialog>
  );
}

// ───────────── nomination
export function NominateModal({ personId, personName, open, onClose, d, defaultStd, asipEligible, self }: {
  personId: string; personName: string; open: boolean; onClose: () => void; d: InsData; defaultStd?: string; asipEligible?: boolean; self?: boolean;
}) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [route, setRoute] = useState('sme');
  const [std, setStd] = useState(defaultStd ?? '');
  const [std2, setStd2] = useState('');
  const [motivation, setMotivation] = useState('');
  const stds = d.stds.filter((s) => s.status === 'current' && !s.security_restricted).sort((a, b) => (a.code < b.code ? -1 : 1));
  const opts = stds.map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'title')}` }));
  return (
    <ConfirmDialog open={open} onClose={onClose} title={self ? t('m02.ins.nominate.selfTitle') : t('m02.ins.nominate.title', { name: personName })} consequence={t('m02.ins.nominate.body')}
      confirmLabel={self ? t('m02.ins.nominate.selfSubmit') : t('m02.ins.nominate.submit')}
      onConfirm={async () => { await run(() => repo.rpc.nominateInstructor({ person_id: personId, route, standard_ids: [std, std2].filter((x, i, a) => x && a.indexOf(x) === i), motivation: motivation.trim() || null })); }}>
      <div className="space-y-3" data-testid="m02-ins-nominate-form">
        <SelectField name="ins-route" label={t('m02.ins.nominate.route')} value={route} onChange={setRoute} options={[{ value: 'sme', label: t('m02.ins.route.sme') }, ...(asipEligible ? [{ value: 'asip', label: t('m02.ins.route.asip') }] : [])]} />
        <SelectField name="ins-standard" label={t('m02.ins.nominate.standard')} value={std} onChange={setStd} placeholder={t('m02.ins.nominate.pick')} options={opts} />
        <SelectField name="ins-f322" label={t('m02.ins.nominate.standard2')} value={std2} onChange={setStd2} placeholder={t('m02.ins.nominate.optional')} options={opts.filter((o) => o.value !== std)} />
        <TextArea name="ins-motivation" label={t('m02.ins.nominate.motivation')} value={motivation} onChange={setMotivation} rows={3} />
        <p className="text-[12px] text-ink-3">{t('m02.ins.nominate.securityNote')}</p>
      </div>
    </ConfirmDialog>
  );
}

// ───────────── sourced facts (every public fact links its source and as-of date)
export const FACT_SOURCES = {
  cns10: 'https://www.iaea.org/sites/default/files/cns-10th-review-meeing-uae-national-report_ae1.pdf',
  reg16: 'https://www.fanr.gov.ae/en/Documents/REG-16-English.pdf',
};
export function ProgrammeFacts({ compact }: { compact?: boolean }) {
  const t = useT();
  const facts = [
    { id: 'asip', icon: 'grad', href: FACT_SOURCES.cns10, src: t('m02.ins.facts.asipSrc') },
    { id: 'reg16', icon: 'shield', href: FACT_SOURCES.reg16, src: t('m02.ins.facts.reg16Src') },
    { id: 'fanr65', icon: 'users', href: FACT_SOURCES.cns10, src: t('m02.ins.facts.fanr65Src') },
  ];
  return (
    <div className={`grid grid-cols-1 gap-3 ${compact ? '' : 'md:grid-cols-3'}`} data-testid="m02-ins-facts">
      {facts.map((x) => (
        <div key={x.id} className="rounded-card border border-line p-3" data-testid={`m02-ins-fact-${x.id}`}>
          <div className="mb-1 flex items-center gap-2 font-semibold"><Icon name={x.icon} size={15} className="text-accent" />{t(`m02.ins.facts.${x.id}Title`)}</div>
          <p className="text-[13px] text-ink-2">{t(`m02.ins.facts.${x.id}Body`)}</p>
          <div className="mt-2"><SourceLink href={x.href} date="2026-03-01">{x.src}</SourceLink></div>
        </div>
      ))}
    </div>
  );
}

export function MirrorNote() {
  const t = useT();
  return <Callout tone="sim" title={t('m02.ins.mirrorTitle')}>{t('m02.ins.mirrorBody')}</Callout>;
}

/** Link to the track page for viewers who may open it (sat R/W/A); otherwise plain text. */
export function TrackLink({ v, children }: { v: TrackView; children: ReactNode }) {
  const s = useSession();
  return s.can('sat', ['R', 'W', 'A']) ? <L to={`/training/instructors/${v.track.id}`} className="link">{children}</L> : <>{children}</>;
}

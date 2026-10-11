// F13 Mentoring 2.0: shared view pieces for /my/mentoring, /my/mentoring/:agreementId and the programme page. Module-local.
import { useMemo, useState, type ReactNode } from 'react';
import { Modal, ConfirmDialog, SelectField, TextArea, TextField, CheckboxField, RadioGroup, Icon, StatusPill, ProgressBar, Callout, type PillTone } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import {
  CADENCES, MAX_GOALS, MAX_REQUEST_SKILLS, MENTORING_TYPES, MENTOR_LEVEL, addDaysIso, agreementProgress, isSecuritySkill, type Goal, type MentoringType,
} from './mentoring';
import type { Agreement, Mentor, Request, Session } from './useMentoring';

type SkillRow = { id: string; name_en: string; name_ar: string; area?: string | null; competency_id: string };
const today = () => new Date().toISOString().slice(0, 10);

export const AGREEMENT_TONE: Record<string, PillTone> = { proposed: 'sim', active: 'ok', closing: 'info', closed: 'neutral', declined: 'bad' };
export function AgreementPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={AGREEMENT_TONE[status] ?? 'neutral'}>{t(`m04.mtr.status.${status}`)}</StatusPill>;
}
export function TypeChip({ type }: { type: string }) {
  const t = useT();
  return <span className="inline-flex items-center gap-1 rounded-full border border-line bg-sunken px-2 py-0.5 text-[12px] text-ink-2" data-testid="m04-type-chip"><Icon name={TYPE_ICON[type] ?? 'users'} size={12} />{t(`m04.mtr.type.${type}`)}</span>;
}
const TYPE_ICON: Record<string, string> = { career: 'grad', knowledge_transfer: 'book', leadership: 'users', reverse: 'sparkle', peer_onboarding: 'home' };
export function SkillChip({ skill, sme, level }: { skill?: SkillRow; sme?: boolean; level?: number | null }) {
  const pick = usePick();
  const t = useT();
  if (!skill) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] ${sme ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line text-ink-2'}`} title={sme ? t('m04.mtr.smeSkill') : undefined}>
      {sme && <Icon name="shield" size={11} />}{pick(skill, 'name')}{level != null && <span className="num text-ink-3">· L{level}</span>}
    </span>
  );
}

/** Counterpart label: the mentor's role title (mentors are role cards), or the colleague's name for the mentor. */
export function useCounterpart(roleTitle: (id: string | null | undefined) => string, name: (id: string | null | undefined) => string) {
  return (a: Pick<Agreement, 'person_id' | 'mentor_person_id' | 'mentor_id'>, me: string | null, mentors: Map<string, Mentor>) =>
    a.person_id === me ? roleTitle(mentors.get(a.mentor_id)?.role_id) || name(a.mentor_person_id) : name(a.person_id);
}

export function AgreementRow({ a, me, label, sessions }: { a: Agreement; me: string | null; label: string; sessions: Session[] }) {
  const t = useT();
  const f = useFormat();
  const mine = sessions.filter((s) => s.agreement_id === a.id).length;
  const p = agreementProgress(a, mine, today());
  const role = a.person_id === me ? 'mentee' : 'mentor';
  return (
    <li className="card flex flex-wrap items-center gap-3 p-3" data-testid="m04-agreement-row" data-status={a.status}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-eyebrow" aria-hidden><Icon name={TYPE_ICON[a.mentoring_type] ?? 'users'} size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <L to={`/my/mentoring/${a.id}`} className="font-semibold">{label}</L>
          <TypeChip type={a.mentoring_type} />
          <AgreementPill status={a.status} />
          <span className="caps">{t(`m04.mtr.youAre.${role}`)}</span>
        </div>
        <div className="mt-0.5 text-[12.5px] text-ink-3">
          {t('m04.mtr.dates', { from: f.date(a.starts_on), to: f.date(a.ends_on) })} · {t(`m04.mtr.cadence.${a.cadence}`)} · {t('m04.mtr.goalsN', { n: f.num(a.goals.length) })}
        </div>
        {['active', 'closing'].includes(a.status) && (
          <div className="mt-2 flex items-center gap-3">
            <div className="w-40"><ProgressBar value={p.pct} tone={p.state === 'behind' ? 'sim' : 'accent'} label={t('m04.mtr.sessionsOf', { n: f.num(p.logged), total: f.num(p.total) })} /></div>
            <span className="text-[12.5px] text-ink-2">{t('m04.mtr.sessionsOf', { n: f.num(p.logged), total: f.num(p.total) })} · {t(`m04.mtr.progress.${p.state}`)}</span>
          </div>
        )}
      </div>
      <L to={`/my/mentoring/${a.id}`} className="btn-outline btn-sm" data-testid="m04-agreement-open">{t('m04.mtr.open')}<Icon name="chevron" size={14} className="rtl:-scale-x-100" /></L>
    </li>
  );
}

// ───────────── request mentoring (rpc.requestMentoring)
export function RequestModal({ mentor, roleTitle, skills, defaultType, defaultSkills, onClose }: {
  mentor: Mentor; roleTitle: string; skills: Map<string, SkillRow>; defaultType?: MentoringType | ''; defaultSkills?: string[]; onClose: () => void;
}) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const types = (mentor.types?.length ? mentor.types : MENTORING_TYPES) as MentoringType[];
  const [type, setType] = useState<string>(defaultType && types.includes(defaultType) ? defaultType : types[0]);
  const [picked, setPicked] = useState<string[]>((defaultSkills ?? []).filter((s) => (mentor.skill_ids ?? []).includes(s)).slice(0, MAX_REQUEST_SKILLS));
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_REQUEST_SKILLS ? cur : [...cur, id]));
  return (
    <>
      <Modal open onClose={onClose} title={t('m04.mtr.requestTitle', { role: roleTitle })} size="lg"
        footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" onClick={() => setConfirm(true)} disabled={!type || message.length > 500} data-testid="m04-request-send">{t('m04.mentor.send')}</button></>}>
        <div className="space-y-4">
          <RadioGroup label={t('m04.mtr.typeLabel')} name="m04-type" value={type} onChange={setType} options={types.map((x) => ({ value: x, label: <span><b>{t(`m04.mtr.type.${x}`)}</b> <span className="text-ink-3">· {t(`m04.mtr.typeHint.${x}`)}</span></span> }))} />
          <fieldset>
            <legend className="mb-1 text-[13px] font-semibold">{t('m04.mtr.skillsLabel', { n: MAX_REQUEST_SKILLS })}</legend>
            <div className="flex flex-wrap gap-2">
              {(mentor.skill_ids ?? []).filter((s) => !isSecuritySkill(skills.get(s) as never)).map((s) => (
                <label key={s} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${picked.includes(s) ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                  <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={picked.includes(s)} onChange={() => toggle(s)} />{skills.get(s) ? pick(skills.get(s)!, 'name') : s}
                </label>
              ))}
            </div>
          </fieldset>
          <TextArea label={t('m04.mentor.message')} hint={t('m04.mentor.messageHint')} name="message" value={message} onChange={setMessage} error={message.length > 500 ? 'common.validation.maxLen:500' : null} />
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m04.mtr.requestConfirm')} consequence={t('m04.mtr.requestConsequence', { role: roleTitle })}
        onConfirm={async () => { const r = await run(() => repo.rpc.requestMentoring({ mentor_id: mentor.id, mentoring_type: type as MentoringType, skill_ids: picked, message: message.trim() })); if (r.ok) onClose(); }} />
    </>
  );
}

// ───────────── propose or revise an agreement (rpc.proposeAgreement)
export function ProposeModal({ request, mentor, current, skills, onClose }: { request: Request; mentor?: Mentor; current?: Agreement; skills: Map<string, SkillRow>; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const options = useMemo(() => {
    const ids = [...new Set([...(request.skill_ids ?? []), ...(mentor?.skill_ids ?? []), ...(current?.goals ?? []).map((g) => g.skill_id)])].filter((s) => skills.has(s) && !isSecuritySkill(skills.get(s) as never));
    return ids.map((id) => ({ value: id, label: pick(skills.get(id)!, 'name') }));
  }, [request, mentor, current, skills, pick]);
  const start = today();
  const [goals, setGoals] = useState<Goal[]>(current?.goals?.length ? current.goals : (request.skill_ids?.length ? request.skill_ids : (mentor?.skill_ids ?? []).slice(0, 1)).slice(0, 3).map((s) => ({ skill_id: s, target_level: MENTOR_LEVEL, text: '' })));
  const [cadence, setCadence] = useState<string>(current?.cadence ?? 'fortnightly');
  const [startsOn, setStartsOn] = useState(current?.starts_on && current.starts_on >= addDaysIso(start, -30) ? current.starts_on : start);
  const [endsOn, setEndsOn] = useState(current?.ends_on ?? addDaysIso(start, 182));
  const [confirm, setConfirm] = useState(false);
  const set = (i: number, patch: Partial<Goal>) => setGoals((cur) => cur.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  const valid = goals.length >= 1 && goals.every((g) => g.skill_id) && new Set(goals.map((g) => g.skill_id)).size === goals.length && !!cadence && !!startsOn && !!endsOn && endsOn > startsOn;
  return (
    <>
      <Modal open onClose={onClose} size="lg" title={current ? t('m04.mtr.reviseTitle') : t('m04.mtr.proposeTitle')}
        footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m04-propose-send">{t('m04.mtr.propose')}</button></>}>
        <div className="space-y-4">
          <p className="text-[13px] text-ink-2">{t('m04.mtr.proposeBody')}</p>
          <div className="space-y-3" data-testid="m04-goals-editor">
            {goals.map((g, i) => (
              <div key={i} className="grid gap-2 rounded-card border border-line p-3 sm:grid-cols-[2fr_1fr]">
                <SelectField label={t('m04.mtr.goalSkill', { n: i + 1 })} name={`goal-${i}`} required value={g.skill_id} onChange={(v) => set(i, { skill_id: v })} options={options} />
                <SelectField label={t('m04.mtr.targetLevel')} name={`lvl-${i}`} required value={String(g.target_level)} onChange={(v) => set(i, { target_level: Number(v) || 1 })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: t(`m04.mtr.level.${n}`) }))} />
                <div className="sm:col-span-2"><TextField label={t('m04.mtr.goalText')} name={`txt-${i}`} value={g.text} onChange={(v) => set(i, { text: v.slice(0, 200) })} hint={t('m04.mtr.goalTextHint')} /></div>
                {goals.length > 1 && <button type="button" className="btn-ghost btn-sm justify-self-start" onClick={() => setGoals((cur) => cur.filter((_, k) => k !== i))}>{t('m04.mtr.removeGoal')}</button>}
              </div>
            ))}
            {goals.length < MAX_GOALS && <button type="button" className="btn-outline btn-sm" onClick={() => setGoals((cur) => [...cur, { skill_id: '', target_level: MENTOR_LEVEL, text: '' }])}><Icon name="plus" size={14} />{t('m04.mtr.addGoal')}</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label={t('m04.mtr.cadenceLabel')} name="cadence" required value={cadence} onChange={setCadence} options={CADENCES.map((c) => ({ value: c, label: t(`m04.mtr.cadence.${c}`) }))} />
            <TextField type="date" label={t('m04.mtr.startsOn')} name="starts" required value={startsOn} onChange={setStartsOn} />
            <TextField type="date" label={t('m04.mtr.endsOn')} name="ends" required value={endsOn} onChange={setEndsOn} hint={t('m04.mtr.durationHint')} />
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m04.mtr.proposeConfirm')} consequence={t('m04.mtr.proposeConsequence')}
        onConfirm={async () => { const r = await run(() => repo.rpc.proposeAgreement(request.id, { goals: goals.map((g) => ({ ...g, text: g.text.trim() })), cadence: cadence as never, starts_on: startsOn, ends_on: endsOn })); if (r.ok) onClose(); }} />
    </>
  );
}

// ───────────── log a session (rpc.logSession); the private note is readable by its author only
export function LogSessionModal({ a, skills, onClose }: { a: Agreement; skills: Map<string, SkillRow>; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [held, setHeld] = useState(today());
  const [minutes, setMinutes] = useState('60');
  const [touched, setTouched] = useState<string[]>(a.goals.map((g) => g.skill_id).slice(0, 1));
  const [topics, setTopics] = useState('');
  const [shared, setShared] = useState('');
  const [priv, setPriv] = useState('');
  const [busy, setBusy] = useState(false);
  const m = Number(minutes);
  const valid = held >= a.starts_on && held <= today() && Number.isInteger(m) && m >= 15 && m <= 480 && touched.length > 0 && topics.length <= 300 && shared.length <= 2000 && priv.length <= 2000;
  return (
    <Modal open onClose={onClose} size="lg" title={t('m04.mtr.logTitle')}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!valid || busy} data-testid="m04-log-send" onClick={async () => {
        setBusy(true);
        const r = await run(() => repo.rpc.logSession(a.id, { held_on: held, minutes: m, skill_ids: touched, topics: topics.trim(), note_shared: shared.trim(), note_private: priv.trim() }), { success: t('m04.mtr.logged') });
        setBusy(false);
        if (r.ok) onClose();
      }}>{t('m04.mtr.logSave')}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField type="date" label={t('m04.mtr.heldOn')} name="held" required value={held} onChange={setHeld} hint={t('m04.mtr.heldOnHint')} />
        <TextField type="number" label={t('m04.mtr.minutes')} name="minutes" required value={minutes} onChange={setMinutes} error={valid || (m >= 15 && m <= 480) ? null : 'common.validation.range:15:480'} />
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[13px] font-semibold">{t('m04.mtr.skillsTouched')}</legend>
          <div className="flex flex-wrap gap-2">
            {a.goals.map((g) => (
              <label key={g.skill_id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${touched.includes(g.skill_id) ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={touched.includes(g.skill_id)} onChange={() => setTouched((cur) => (cur.includes(g.skill_id) ? cur.filter((x) => x !== g.skill_id) : [...cur, g.skill_id]))} />
                {skills.get(g.skill_id) ? pick(skills.get(g.skill_id)!, 'name') : g.skill_id}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2"><TextField label={t('m04.mtr.topics')} name="topics" value={topics} onChange={setTopics} hint={t('m04.mtr.topicsHint')} /></div>
        <TextArea label={t('m04.mtr.sharedNote')} name="shared" rows={3} value={shared} onChange={setShared} hint={t('m04.mtr.sharedNoteHint')} />
        <div>
          <TextArea label={<span className="inline-flex items-center gap-1"><Icon name="lock" size={13} />{t('m04.mtr.privateNote')}</span>} name="private" rows={3} value={priv} onChange={setPriv} hint={t('m04.mtr.privateNoteHint')} />
        </div>
      </div>
    </Modal>
  );
}

// ───────────── close-out (rpc.closeAgreement): both rate goal attainment; an SME mentor of a KT agreement can validate claims
export function CloseOutModal({ a, side, mentor, skills, onClose }: { a: Agreement; side: 'mentee' | 'mentor'; mentor?: Mentor; skills: Map<string, SkillRow>; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [validate, setValidate] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const kt = a.mentoring_type === 'knowledge_transfer' && side === 'mentor';
  const sme = !!mentor?.sme;
  const valid = a.goals.every((g) => ratings[g.skill_id]) && note.length <= 2000;
  return (
    <>
      <Modal open onClose={onClose} size="lg" title={t('m04.mtr.closeTitle')}
        footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m04-close-send">{t('m04.mtr.closeSubmit')}</button></>}>
        <div className="space-y-4">
          <p className="text-[13px] text-ink-2">{t(side === 'mentee' ? 'm04.mtr.closeBodyMentee' : 'm04.mtr.closeBodyMentor')}</p>
          {a.goals.map((g) => (
            <div key={g.skill_id} className="rounded-card border border-line p-3" data-testid="m04-rate-goal">
              <RadioGroup label={<span>{skills.get(g.skill_id) ? pick(skills.get(g.skill_id)!, 'name') : g.skill_id}{g.text ? <span className="block text-[12.5px] font-normal text-ink-3">{g.text}</span> : null}</span>}
                name={`rate-${g.skill_id}`} value={ratings[g.skill_id] ?? ''} onChange={(v) => setRatings((cur) => ({ ...cur, [g.skill_id]: v }))}
                options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: t(`m04.mtr.rating.${n}`) }))} />
            </div>
          ))}
          <TextArea label={t('m04.mtr.closeNote')} name="note" rows={3} value={note} onChange={setNote} hint={t('m04.mtr.closeNoteHint')} />
          {kt && (sme
            ? <CheckboxField label={t('m04.mtr.validateLabel')} hint={t('m04.mtr.validateHint')} checked={validate} onChange={setValidate} />
            : <Callout title={t('m04.mtr.notSmeTitle')}>{t('m04.mtr.notSmeBody')}</Callout>)}
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m04.mtr.closeConfirm')} consequence={t(validate ? 'm04.mtr.closeConsequenceValidate' : 'm04.mtr.closeConsequence')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.closeAgreement(a.id, { ratings: a.goals.map((g) => ({ skill_id: g.skill_id, rating: Number(ratings[g.skill_id]) })), note: note.trim(), validate: kt && sme && validate }));
          if (r.ok) onClose();
        }} />
    </>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-ink-3">{children}</p>;
}

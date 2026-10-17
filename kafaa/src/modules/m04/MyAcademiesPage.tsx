// FS20 /my/academies (staff): my nominations and places (stage, module progress from my M04 enrolments, mentor and reviewer, the
// capstone editor: save a draft or submit; feedback when returned; the evidence a sign-off recorded), the capstones I review as the
// named reviewer (merit, pass or not yet, with what each records), the members I mentor, and nominating someone in my team.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, BenchmarkChips, Icon, Modal, SelectField, TextArea, TextField, RadioGroup, ConfirmDialog, Stepper, StatusPill, Callout } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { ARTEFACT_KINDS, STAGE_ORDER, evidenceLevel, memberStage } from './academy';
import { G2Pill, usePeople } from './ui';
import { CapstonePill, CohortPill, LevelDots, MemberPill, NoDecisionNote, SkillChip, useAcademyData, type AcademyData, type Row } from './fsUi';
import { NominateModal } from './LearnAcademyPage';

export default function MyAcademiesPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const ref = useAcademyData();
  const q = useQuery(['academy_members', 'cohort_capstones', 'enrolments'], async () => {
    const [members, caps, enr] = await Promise.all([repo.list('academy_members'), repo.list('cohort_capstones'), repo.list('enrolments', { filter: { person_id: me } })]);
    return { members: members as Row[], caps: caps as Row[], enr: enr as Row[] };
  }, [me]);
  return (
    <Page title={t('m04.routes.my-academies.title')} intro={t('m04.my.acad.intro')} wide eyebrow={<BenchmarkChips feature="FS20" />}
      actions={<L to="/learn/academies" className="btn-outline no-underline">{t('m04.my.acad.browse')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(x) => <Mine d={d} x={x} me={me} />}</Async>}</Async>
    </Page>
  );
}

function Mine({ d, x, me }: { d: AcademyData; x: { members: Row[]; caps: Row[]; enr: Row[] }; me: string }) {
  const t = useT();
  const s = useSession();
  const [nominate, setNominate] = useState<Row | null>(null);
  const mine = x.members.filter((m) => m.person_id === me).sort((a, b) => String(b.nominated_at).localeCompare(String(a.nominated_at)));
  const reviewing = x.caps.filter((k) => k.reviewer_person_id === me && k.person_id !== me);
  const mentoring = x.members.filter((m) => m.mentor_person_id === me && m.person_id !== me && ['accepted', 'active', 'completed'].includes(m.status));
  const openAcademies = d.academies.filter((a) => d.cohorts.some((c) => c.academy_id === a.id && c.status === 'nominating'));
  const manager = s.hasRole('manager');
  return (
    <div className="space-y-6">
      <Section title={t('m04.my.acad.places')}>
        {mine.length === 0 ? <EmptyState icon="grad" title={t('m04.my.acad.none')} action={<L to="/learn/academies" className="btn-primary btn-sm no-underline">{t('m04.my.acad.browse')}</L>}>{t('m04.my.acad.noneBody')}</EmptyState> : (
          <div className="space-y-4" data-testid="m04-my-acad">
            {mine.map((m) => <Place key={m.id} d={d} m={m} cap={x.caps.find((k) => k.member_id === m.id)} enr={x.enr} />)}
          </div>
        )}
      </Section>

      {reviewing.length > 0 && <Reviews d={d} caps={reviewing} />}

      {mentoring.length > 0 && <Mentees d={d} members={mentoring} caps={x.caps} />}

      <Section title={manager ? t('m04.my.acad.nominateTeam') : t('m04.my.acad.nominateSelf')} description={t('m04.my.acad.nominateIntro')}>
        {openAcademies.length === 0 ? <p className="text-[13px] text-ink-3">{t('m04.my.acad.noOpen')}</p> : (
          <div className="flex flex-wrap gap-2" data-testid="m04-my-acad-nominate">
            {openAcademies.map((a) => <button key={a.id} type="button" className="btn-outline btn-sm" onClick={() => setNominate(a)}><Icon name="plus" size={13} /><UsePick row={a} col="name" /></button>)}
          </div>
        )}
      </Section>
      {nominate && <NominateModal academy={nominate} cohorts={d.cohorts.filter((c) => c.academy_id === nominate.id && c.status === 'nominating')} onClose={() => setNominate(null)} />}
    </div>
  );
}
function UsePick({ row, col }: { row: Row; col: string }) {
  const pick = usePick();
  return <>{pick(row, col)}</>;
}

function Place({ d, m, cap, enr }: { d: AcademyData; m: Row; cap: Row | undefined; enr: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const people = usePeople();
  const a = d.academies.find((x) => x.id === m.academy_id)!;
  const c = d.cohorts.find((x) => x.id === m.cohort_id)!;
  const mods = (a.module_course_ids ?? []) as string[];
  const enrOf = (cid: string) => enr.filter((e) => e.course_id === cid && e.status !== 'cancelled').sort((p, q) => String(q.enrolled_at).localeCompare(String(p.enrolled_at)))[0];
  const done = mods.filter((cid) => enrOf(cid)?.status === 'completed').length;
  const stage = memberStage(m as { status: string }, cap as { status: string } | undefined, done, mods.length);
  const steps = STAGE_ORDER.filter((x) => x !== 'capstone_returned' || stage === 'capstone_returned');
  const current = Math.max(0, steps.indexOf(stage));
  return (
    <Card eyebrow={<span className="flex flex-wrap items-center gap-2"><CohortPill status={c.status} />{pick(c, 'label')} · {f.date(c.starts_on)} – {f.date(c.ends_on)}</span>}
      title={<span className="flex flex-wrap items-center gap-2"><L to={`/learn/academies/${a.id}`} className="no-underline">{pick(a, 'name')}</L><MemberPill status={m.status} /></span>}>
      <div data-testid="m04-my-place" data-member={m.id} data-stage={stage}>
        {['declined', 'withdrawn'].includes(stage) ? <p className="text-[13px] text-ink-2">{m.decision_note ?? t(`m04.acad.memberStatus.${stage}`)}</p> : (
          <div className="overflow-x-auto"><Stepper steps={steps.map((x) => ({ id: x, label: t(`m04.acad.stage.${x}`) }))} current={current} /></div>
        )}
        {m.mentor_person_id && (
          <p className="mt-3 text-[13px] text-ink-2"><Icon name="users" size={13} className="me-1 inline" />{t('m04.acad.triad.mentor')}: <strong>{people.name(m.mentor_person_id)}</strong> · {t('m04.acad.triad.reviewer')}: <strong>{people.name(m.reviewer_person_id)}</strong></p>
        )}
        {['accepted', 'active', 'completed'].includes(m.status) && (
          <div className="mt-3">
            <h3 className="caps mb-1.5">{t('m04.my.acad.modules', { done: f.num(done), total: f.num(mods.length) })}</h3>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {mods.map((cid) => <li key={cid} className="flex items-center justify-between gap-2 rounded-md bg-sunken px-2 py-1.5 text-[12.5px]"><L to={`/learn/course/${cid}`} className="min-w-0 truncate text-eyebrow">{pick(d.courses.get(cid), 'title') || cid}</L><G2Pill status={enrOf(cid)?.status ?? 'assigned'} /></li>)}
            </ul>
          </div>
        )}
        {cap && <CapstonePanel d={d} a={a} m={m} c={c} cap={cap} />}
        {a.no_decision && <div className="mt-2"><NoDecisionNote /></div>}
      </div>
    </Card>
  );
}

function CapstonePanel({ d, a, m, c, cap }: { d: AcademyData; a: Row; m: Row; c: Row; cap: Row }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const editable = (m.status === 'active' || (m.status === 'accepted' && ['running', 'completed'].includes(c.status))) && ['draft', 'returned'].includes(cap.status);
  const [title, setTitle] = useState(cap.title ?? '');
  const [summary, setSummary] = useState(cap.summary ?? '');
  const [kind, setKind] = useState(cap.artefact_kind ?? a.artefact_kind);
  const [confirm, setConfirm] = useState(false);
  const save = (submit: boolean) => run(() => repo.rpc.saveCapstone({ member_id: m.id, title, summary, artefact_kind: kind, lang: 'en', submit }), { success: submit ? t('m04.my.acad.cap.submitted') : t('m04.my.acad.cap.saved') });
  return (
    <div className="mt-4 rounded-card border border-line p-3" data-testid="m04-my-capstone" data-status={cap.status}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{t('m04.my.acad.cap.title')}</h3><CapstonePill status={cap.status} result={cap.result} /></div>
      <p className="mb-2 text-[12.5px] text-ink-3">{pick(a, 'project')}</p>
      {cap.status === 'returned' && cap.feedback && <Callout tone="sim" title={t('m04.my.acad.cap.feedback')}>{cap.feedback}</Callout>}
      {editable ? (
        <div className="space-y-2">
          <TextField name={`m04-cap-title-${m.id}`} label={t('m04.my.acad.cap.name')} value={title} onChange={setTitle} hint={t('m04.my.acad.cap.nameHint')} />
          <TextArea name={`m04-cap-summary-${m.id}`} label={t('m04.my.acad.cap.summary')} value={summary} onChange={setSummary} rows={4} hint={t('m04.my.acad.cap.summaryHint')} />
          <SelectField name={`m04-cap-kind-${m.id}`} label={t('m04.my.acad.cap.kind')} value={kind} onChange={setKind} options={ARTEFACT_KINDS.map((k) => ({ value: k, label: t(`m04.acad.kind.${k}`) }))} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => save(false)} data-testid="m04-cap-save">{t('m04.my.acad.cap.saveDraft')}</button>
            <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m04-cap-submit">{t('m04.my.acad.cap.submit')}</button>
          </div>
          <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m04.my.acad.cap.submit')} consequence={t('m04.my.acad.cap.consequence')} onConfirm={async () => { await save(true); }} />
        </div>
      ) : (
        <div className="space-y-1 text-[13px]">
          {cap.title && <p className="font-medium">{cap.title}</p>}
          {cap.summary && <p className="text-ink-2">{cap.summary}</p>}
          {cap.status === 'submitted' && <p className="text-[12.5px] text-ink-3">{t('m04.my.acad.cap.withReviewer')}</p>}
          {cap.status === 'draft' && !editable && <p className="text-[12.5px] text-ink-3">{t('m04.my.acad.cap.notYetOpen')}</p>}
          {cap.status === 'signed_off' && (
            <div className="mt-2">
              {cap.feedback && <p className="text-ink-2">“{cap.feedback}”</p>}
              <h4 className="caps mt-2 mb-1">{t('m04.my.acad.cap.recorded')}</h4>
              <div className="flex flex-wrap gap-1.5">{(a.capstone_skills ?? []).map((x: { skill_id: string; level: number }) => <SkillChip key={x.skill_id} skill={d.skills.get(x.skill_id)} level={evidenceLevel(cap.result, x.level)} />)}</div>
              <L to="/my/skills" className="mt-2 inline-block text-[12.5px]">{t('m04.my.acad.cap.passport')}</L>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Reviews({ d, caps }: { d: AcademyData; caps: Row[] }) {
  const t = useT();
  const pick = usePick();
  const people = usePeople();
  const [open, setOpen] = useState<Row | null>(null);
  const order = { submitted: 0, returned: 1, draft: 2, signed_off: 3 } as Record<string, number>;
  const list = useMemo(() => [...caps].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.id).localeCompare(String(b.id))), [caps]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = caps.filter((k) => k.status === 'submitted').length;
  return (
    <Section title={t('m04.my.acad.review.title')} description={t('m04.my.acad.review.intro', { n: waiting })}>
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2" data-testid="m04-my-reviews">
        {list.map((k) => {
          const a = d.academies.find((x) => x.id === k.academy_id);
          return (
            <li key={k.id} className="card flex flex-col gap-1.5 p-3" data-capstone={k.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{people.name(k.person_id)}</span><CapstonePill status={k.status} result={k.result} /></div>
              <p className="text-[12.5px] text-ink-3">{pick(a, 'name')}</p>
              {k.title && <p className="text-[13px]">{k.title}</p>}
              {k.status === 'submitted' && <button type="button" className="btn-primary btn-sm self-start" onClick={() => setOpen(k)} data-testid="m04-review-open">{t('m04.my.acad.review.open')}</button>}
            </li>
          );
        })}
      </ul>
      {open && <SignoffModal d={d} cap={open} onClose={() => setOpen(null)} />}
    </Section>
  );
}

function SignoffModal({ d, cap, onClose }: { d: AcademyData; cap: Row; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const a = d.academies.find((x) => x.id === cap.academy_id)!;
  const [result, setResult] = useState('pass');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} size="lg" title={t('m04.my.acad.review.modal', { name: people.name(cap.person_id) })}
      footer={<div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={busy} data-testid="m04-review-confirm" onClick={async () => {
          setBusy(true);
          const r = await run(() => repo.rpc.signoffCapstone({ capstone_id: cap.id, result: result as never, feedback }), { success: result === 'not_yet' ? t('m04.my.acad.review.returned') : t('m04.my.acad.review.signed') });
          setBusy(false);
          if (r.ok) onClose();
        }}>{result === 'not_yet' ? t('m04.my.acad.review.return') : t('m04.my.acad.review.sign')}</button></div>}>
      <div className="space-y-3">
        <p className="caps">{pick(a, 'name')} · {t(`m04.acad.kind.${cap.artefact_kind}`)}</p>
        <p className="font-semibold">{cap.title}</p>
        <p className="whitespace-pre-line text-[13px] text-ink-2">{cap.summary}</p>
        <RadioGroup label={t('m04.my.acad.review.result')} name="m04-review-result" value={result} onChange={setResult} options={['merit', 'pass', 'not_yet'].map((r) => ({ value: r, label: t(`m04.acad.result.${r}`) }))} />
        <div className="rounded-md bg-sunken p-2 text-[12.5px]" data-testid="m04-review-records">
          <span className="caps me-1">{t('m04.my.acad.review.willRecord')}</span>
          {result === 'not_yet' ? t('m04.my.acad.review.nothing') : (
            <span className="inline-flex flex-wrap gap-1.5">{(a.capstone_skills ?? []).map((x: { skill_id: string; level: number }) => <span key={x.skill_id} className="inline-flex items-center gap-1">{pick(d.skills.get(x.skill_id), 'name')} <LevelDots level={evidenceLevel(result, x.level)} /></span>)}</span>
          )}
        </div>
        <TextArea name="m04-review-feedback" label={t('m04.my.acad.review.feedback')} value={feedback} onChange={setFeedback} rows={3} hint={result === 'not_yet' ? t('m04.my.acad.review.feedbackNeeded') : t('m04.my.acad.review.feedbackHint')} />
        <p className="text-[12px] text-ink-3">{t('m04.my.acad.review.note')}</p>
      </div>
    </Modal>
  );
}

function Mentees({ d, members, caps }: { d: AcademyData; members: Row[]; caps: Row[] }) {
  const t = useT();
  const pick = usePick();
  const people = usePeople();
  return (
    <Section title={t('m04.my.acad.mentor.title')} description={t('m04.my.acad.mentor.intro')}>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="m04-my-mentees">
        {members.map((m) => {
          const k = caps.find((x) => x.member_id === m.id);
          return (
            <li key={m.id} className="card flex items-center justify-between gap-2 p-3 text-[13px]">
              <span className="min-w-0"><span className="block font-medium">{people.name(m.person_id)}</span><span className="text-ink-3">{pick(d.academies.find((a) => a.id === m.academy_id), 'name')}</span></span>
              {k ? <CapstonePill status={k.status} result={k.result} /> : <StatusPill>{t(`m04.acad.memberStatus.${m.status}`)}</StatusPill>}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

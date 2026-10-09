// /opportunities/reserve/me (M20 · F23): my reserve membership. The consent form (availability, hours, preferred engagements,
// expert-finder opt-in) with a preview of the skills that will be frozen from my F01 passport; once a member, the alumni-only
// reserve board (HR-approved requests ranked for me by the F08 match engine, with <WhyThis>), my engagements, and withdrawal of
// consent (hidden everywhere at once; erasure after six months). Every action is an RPC behind a ConfirmDialog.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Tabs, Icon, ConfirmDialog, Modal, TextArea, TextField, CheckboxField, RadioGroup, WhyThis, EngineBadge, KeyValue } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { PersonSkillsRow } from '../../data/types';
import { AVAILABILITY, ENGAGEMENTS, RESTRICTED_FAMILIES, snapshotFrom, validateJoin, type BoardRequest, type JoinInput, type ReserveBoard } from './reserve';
import { rankRequestsForMember } from './reserveMatch';
import { MatchRing, Meta } from './ui';
import { AvailChip, EngChip, EngPill, HandoffNote, MemberKindChip, SnapshotSkills, todayIso, useRefData, useResLabels, type RefData, type ResLabels } from './reserveUi';

export default function ReserveMePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const ref = useRefData();
  const q = useQuery(['alumni', 'reserve_requests', 'reserve_engagements', 'person_skills'], async () => {
    const [board, states] = await Promise.all([
      repo.rpc.reserveBoard(),
      me ? repo.list('person_skills', { filter: { person_id: me, active: true } }) : Promise.resolve([] as PersonSkillsRow[]),
    ]);
    return { board, states };
  }, [me]);
  return (
    <Page title={t('m20.routes.reserve-me.title')} eyebrow={t('m20.res.hub.eyebrow')} intro={t('m20.res.me.intro')} wide
      actions={<L to="/opportunities/reserve" className="btn-outline btn-sm"><Icon name="back" size={14} className="rtl:-scale-x-100" />{t('m20.res.me.back')}</L>}>
      <Async state={ref} isEmpty={() => false}>
        {(d) => <Async state={q} isEmpty={() => false}>{(x) => <Body refd={d} board={x.board} states={x.states} family={s.person?.job_family_id ?? null} />}</Async>}
      </Async>
    </Page>
  );
}

function Body({ refd, board, states, family }: { refd: RefData; board: ReserveBoard | null; states: PersonSkillsRow[]; family: string | null }) {
  const t = useT();
  const f = useFormat();
  const lab = useResLabels(refd);
  if (family && RESTRICTED_FAMILIES.includes(family)) return <Callout tone="info" title={t('m20.res.me.restrictedTitle')}>{t('m20.res.me.restrictedBody')}</Callout>;
  const m = board?.member;
  if (!m) return <JoinForm refd={refd} states={states} lab={lab} existing={null} />;
  if (m.status !== 'active') {
    return (
      <div className="space-y-4">
        <Callout tone="sim" title={t('m20.res.me.withdrawnTitle')}>
          <span data-testid="m20-res-withdrawn">{t('m20.res.me.withdrawnBody', { date: m.withdrawn_on ? f.date(m.withdrawn_on) : '', erase: m.erase_after ? f.date(m.erase_after) : '' })}</span>
        </Callout>
        <JoinForm refd={refd} states={states} lab={lab} existing={null} rejoin />
      </div>
    );
  }
  return (
    <Tabs initial="board" tabs={[
      { id: 'board', label: t('m20.res.me.tabBoard'), badge: board!.requests.filter((r) => !r.my_status).length || undefined, content: <BoardTab board={board!} refd={refd} lab={lab} /> },
      { id: 'engagements', label: t('m20.res.me.tabEngagements'), badge: board!.engagements.length || undefined, content: <EngagementsTab board={board!} /> },
      { id: 'membership', label: t('m20.res.me.tabMembership'), content: <MembershipTab board={board!} refd={refd} states={states} lab={lab} /> },
    ]} />
  );
}

function BoardTab({ board, refd, lab }: { board: ReserveBoard; refd: RefData; lab: ResLabels }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const eng = useEngine('match');
  const today = todayIso();
  const ranked = useMemo(() => rankRequestsForMember({ ...board.member, departed_on: null }, board.requests, refd.skills, today), [board, refd.skills, today]);
  const [open, setOpen] = useState<BoardRequest | null>(null);
  const [note, setNote] = useState('');
  const [withdraw, setWithdraw] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-2">{t('m20.res.me.boardSub')}</p>
        <EngineBadge engine={eng} />
      </div>
      {ranked.length === 0 ? <EmptyState icon="briefcase" title={t('m20.res.me.noRequests')}>{t('m20.res.me.noRequestsBody')}</EmptyState> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m20-res-board">
          {ranked.map((r) => {
            const q = r.item!.req;
            return (
              <Card key={q.id} as="article" className="flex flex-col">
                <div className="flex items-start gap-3" data-testid="m20-res-board-card">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1.5"><EngChip kind={q.engagement} />{q.my_status && <EngPill status={q.my_status} />}</div>
                    <h3 className="text-[15.5px] font-semibold leading-snug">{pick(q, 'title')}</h3>
                    <div className="mt-0.5 text-[12.5px] text-ink-2" data-testid="m20-res-board-team">{pick(q, 'host_team')} · {lab.family(q.family_id)}</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5"><MatchRing score={r.score} /><span className="caps">{t('m20.res.fit')}</span></div>
                </div>
                <p className="mt-2 line-clamp-3 text-[13.5px] text-ink-2">{pick(q, 'summary')}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <Meta icon="calendar">{f.date(q.start_on)} – {f.date(q.end_on)}</Meta>
                  <Meta icon="reset">{t('m20.res.hoursTotal', { n: f.num(q.hours_total) })}</Meta>
                  <Meta icon="globe">{t(`m20.res.loc.${q.location_type}`)}</Meta>
                  <Meta icon="users">{t('m20.res.seatsLeft', { n: f.num(q.seats_left) })}</Meta>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">{q.skills_needed.map((id) => <li key={id} className="chip border-line bg-sunken text-ink-2">{lab.skill(id)}</li>)}</ul>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 mt-3">
                  <WhyThis reasons={r.reasons} testId="m20-res-why" />
                  {!q.my_status || q.my_status === 'withdrawn' ? (
                    <button type="button" className="btn-primary btn-sm" onClick={() => { setNote(''); setOpen(q); }} data-testid="m20-res-interest">{t('m20.res.me.interest')}</button>
                  ) : q.my_status === 'invited' ? (
                    <button type="button" className="btn-primary btn-sm" onClick={() => { setNote(''); setOpen(q); }} data-testid="m20-res-accept">{t('m20.res.me.accept')}</button>
                  ) : ['interested', 'handed_to_hr'].includes(q.my_status) && q.my_engagement_id ? (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setWithdraw(q.my_engagement_id)}>{t('m20.res.me.withdrawEng')}</button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <HandoffNote />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? pick(open, 'title') : ''}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" data-testid="m20-res-interest-send" onClick={async () => { const r = await run(() => repo.rpc.reserveInterest(open!.id, note)); if (r.ok) setOpen(null); }}>{t('m20.res.me.sendInterest')}</button>
        </>}>
        <p className="mb-3 text-[13px] text-ink-2">{t('m20.res.me.interestBody')}</p>
        <TextArea name="note" label={t('m20.res.me.noteLabel')} hint={t('m20.res.me.noteHint')} value={note} onChange={setNote} />
      </Modal>
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m20.res.me.withdrawEngTitle')} consequence={t('m20.res.me.withdrawEngBody')} danger
        onConfirm={async () => { if (withdraw) await run(() => repo.rpc.decideReserveEngagement(withdraw, 'withdraw')); }} />
    </div>
  );
}

function EngagementsTab({ board }: { board: ReserveBoard }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!board.engagements.length) return <EmptyState icon="briefcase" title={t('m20.res.me.noEngagements')} />;
  return (
    <div className="space-y-3" data-testid="m20-res-my-engagements">
      {board.engagements.map((e) => (
        <Card key={e.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap gap-1.5"><EngChip kind={e.engagement} /><EngPill status={e.status} /></div>
              <div className="font-semibold">{pick(e, 'title')}</div>
              <div className="text-[12.5px] text-ink-3">{pick(e, 'host_team')} · {f.date(e.start_on)} – {f.date(e.end_on)} · {t('m20.res.hoursTotal', { n: f.num(e.hours_total) })}</div>
            </div>
            <span className="text-[12px] text-ink-3">{t('m20.res.me.updated', { date: f.date(e.updated_at) })}</span>
          </div>
          {e.status === 'handed_to_hr' && <div className="mt-2 rounded-btn bg-ok-bg px-3 py-2 text-[13px] text-ok">{t('m20.res.me.handedBody')}</div>}
          {e.outcome_note && <p className="mt-2 text-[13px] text-ink-2">“{e.outcome_note}”</p>}
        </Card>
      ))}
    </div>
  );
}

function MembershipTab({ board, refd, states, lab }: { board: ReserveBoard; refd: RefData; states: PersonSkillsRow[]; lab: ResLabels }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const m = board.member;
  const [withdraw, setWithdraw] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <JoinForm refd={refd} states={states} lab={lab} existing={board} />
      <aside className="space-y-4">
        <Card title={t('m20.res.me.frozenTitle')}>
          <div className="mb-2 flex flex-wrap gap-1.5"><MemberKindChip kind={m.kind} /><AvailChip availability={m.availability} hours={m.hours_month} /></div>
          <p className="mb-2 text-[12.5px] text-ink-3">{t('m20.res.me.frozenOn', { date: f.date(m.snapshot_on) })}</p>
          <SnapshotSkills snapshot={m.skill_snapshot} lab={lab} />
          <KeyValue items={[[t('m20.res.me.finder'), m.finder_optin ? t('m20.res.me.finderOn') : t('m20.res.me.finderOff')]]} />
        </Card>
        <Card title={t('m20.res.me.withdrawTitle')}>
          <p className="text-[13px] text-ink-2">{t('m20.res.me.withdrawText')}</p>
          <button type="button" className="btn-outline mt-3 w-full text-bad" onClick={() => setWithdraw(true)} data-testid="m20-res-withdraw">{t('m20.res.me.withdrawBtn')}</button>
        </Card>
      </aside>
      <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} title={t('m20.res.me.withdrawConfirmTitle')} consequence={t('m20.res.me.withdrawConfirmBody')} danger confirmLabel={t('m20.res.me.withdrawBtn')}
        onConfirm={async () => { await run(() => repo.rpc.joinReserve({ consent: false })); }} />
    </div>
  );
}

function JoinForm({ refd, states, lab, existing, rejoin }: { refd: RefData; states: PersonSkillsRow[]; lab: ResLabels; existing: ReserveBoard | null; rejoin?: boolean }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const m = existing?.member;
  const [avail, setAvail] = useState<string>(m?.availability ?? 'limited');
  const [hours, setHours] = useState(String(m?.hours_month ?? 8));
  const [prefs, setPrefs] = useState<string[]>(m?.engagement_prefs ?? ['mentor']);
  const [finder, setFinder] = useState<boolean>(m?.finder_optin ?? false);
  const [hEn, setHEn] = useState('');
  const [hAr, setHAr] = useState('');
  const [consent, setConsent] = useState(!!m);
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const input: JoinInput = { consent: true, availability: avail, hours_month: Number(hours), engagement_prefs: prefs, finder_optin: finder, headline_en: hEn.trim() || null, headline_ar: hAr.trim() || null };
  const problem = validateJoin(input);
  const preview = snapshotFrom(states, refd.skills);
  return (
    <Card title={m ? t('m20.res.me.editTitle') : rejoin ? t('m20.res.me.rejoinTitle') : t('m20.res.me.joinTitle')}>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()} data-testid="m20-res-join-form">
        {!m && <p className="text-[13.5px] text-ink-2">{t('m20.res.me.joinIntro')}</p>}
        <RadioGroup label={t('m20.res.me.availability')} name="availability" value={avail} onChange={setAvail} options={AVAILABILITY.map((k) => ({ value: k, label: t(`m20.res.avail.${k}`) }))} />
        <TextField type="number" name="hours" label={t('m20.res.me.hours')} hint={t('m20.res.me.hoursHint')} value={hours} onChange={setHours} />
        <fieldset>
          <legend className="text-[13px] font-semibold">{t('m20.res.me.prefs')}</legend>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {ENGAGEMENTS.map((k) => <CheckboxField key={k} label={t(`m20.res.eng.${k}`)} hint={t(`m20.res.engHint.${k}`)} checked={prefs.includes(k)} onChange={(c) => setPrefs((cur) => (c ? [...cur, k] : cur.filter((x) => x !== k)))} />)}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="headline_en" label={t('m20.res.me.headlineEn')} hint={t('m20.res.me.headlineHint')} value={hEn} onChange={setHEn} />
          <TextField name="headline_ar" label={t('m20.res.me.headlineAr')} hint={t('m20.res.me.headlineHint')} value={hAr} onChange={setHAr} />
        </div>
        <CheckboxField label={t('m20.res.me.finderLabel')} hint={t('m20.res.me.finderHint')} checked={finder} onChange={setFinder} />
        <Section title={t('m20.res.me.previewTitle')} description={t('m20.res.me.previewSub')}>
          <SnapshotSkills snapshot={preview} lab={lab} testId="m20-res-preview" />
        </Section>
        {!m && <CheckboxField label={t('m20.res.me.consentLabel')} hint={t('m20.res.me.consentHint')} checked={consent} onChange={setConsent} />}
        {touched && problem && <p className="text-[12.5px] text-bad" role="alert" data-testid="m20-res-join-problem">{problem.message}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={!consent} onClick={() => { setTouched(true); if (!problem) setConfirm(true); }} data-testid="m20-res-join">{m ? t('m20.res.me.save') : t('m20.res.me.joinBtn')}</button>
          <HandoffNote>{t('m20.res.me.noContact')}</HandoffNote>
        </div>
      </form>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={m ? t('m20.res.me.saveTitle') : t('m20.res.me.joinConfirmTitle')} consequence={t('m20.res.me.joinConfirmBody', { n: preview.length })}
        actingAs={s.person ? s.person.display_name : undefined}
        onConfirm={async () => { await run(() => repo.rpc.joinReserve(input)); }} />
    </Card>
  );
}

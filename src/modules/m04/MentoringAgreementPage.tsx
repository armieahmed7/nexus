// /my/mentoring/:agreementId (M04 · F13): one mentoring agreement for the two people in the pair: skill goals, cadence and progress,
// the session log (shared notes for both; my private notes for me only, as the database returns them), and the close-out where both
// rate goal attainment. A subject-matter-expert mentor's knowledge-transfer close-out can validate the mentee's open claims.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, KeyValue, Timeline, ProgressRing, ConfirmDialog, TextArea, Icon, StatTile, Grid } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { usePeople } from './ui';
import { useMentoring } from './useMentoring';
import { MET, agreementProgress, attainmentPct } from './mentoring';
import { AgreementPill, CloseOutModal, LogSessionModal, ProposeModal, SkillChip, TypeChip } from './mentoringUi';

export default function MentoringAgreementPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const { agreementId = '' } = useParams();
  const { q, me, derived } = useMentoring();
  const [log, setLog] = useState(false);
  const [close, setClose] = useState(false);
  const [revise, setRevise] = useState(false);
  const [respond, setRespond] = useState<'accept' | 'decline' | null>(null);
  const [declineNote, setDeclineNote] = useState('');
  return (
    <Page title={t('m04.routes.my-mentoring-agreement.title')} eyebrow={<L to="/my/mentoring">{t('m04.mtr.back')}</L>} wide>
      <Async state={q} isEmpty={(d) => !d.agreements.some((a) => a.id === agreementId)}
        empty={<EmptyState icon="users" title={t('m04.mtr.notFound')} action={<L to="/my/mentoring" className="btn-outline btn-sm">{t('m04.mtr.back')}</L>}>{t('m04.mtr.notFoundBody')}</EmptyState>}>
        {(d) => {
          if (!derived) return null;
          const a = d.agreements.find((x) => x.id === agreementId)!;
          const side: 'mentee' | 'mentor' = a.person_id === me ? 'mentee' : 'mentor';
          const mentor = derived.mentorBy.get(a.mentor_id);
          const roleTitle = (id: string | null | undefined) => pick(d.roles.find((r) => r.id === id), 'title') || '';
          const other = side === 'mentee' ? roleTitle(mentor?.role_id) || people.name(a.mentor_person_id) : people.name(a.person_id);
          const sessions = d.sessions.filter((s) => s.agreement_id === a.id).sort((x, y) => (x.held_on < y.held_on ? 1 : -1));
          const notes = new Map(d.notes.filter((n) => n.agreement_id === a.id && n.author_person_id === me).map((n) => [n.session_id, n.note]));
          const today = new Date().toISOString().slice(0, 10);
          const p = agreementProgress(a, sessions.length, today);
          const minutes = sessions.reduce((s, x) => s + Number(x.minutes ?? 0), 0);
          const myClosed = side === 'mentee' ? a.mentee_closed_at : a.mentor_closed_at;
          const req = d.requests.find((r) => r.id === a.request_id);
          const touched = new Map<string, number>();
          for (const s of sessions) for (const k of s.skill_ids ?? []) touched.set(k, (touched.get(k) ?? 0) + 1);
          const rating = (list: { skill_id: string; rating: number }[] | null | undefined, sk: string) => list?.find((r) => r.skill_id === sk)?.rating;
          return (
            <div className="space-y-6">
              <Card padded>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="caps">{t(`m04.mtr.youAre.${side}`)}</div>
                    <h2 className="mt-1 text-[20px] font-semibold" data-testid="m04-agreement-title">{t(side === 'mentee' ? 'm04.mtr.withMentor' : 'm04.mtr.withMentee', { name: other })}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><TypeChip type={a.mentoring_type} /><AgreementPill status={a.status} />
                      {mentor?.sme && <span className="caps text-eyebrow"><Icon name="shield" size={12} /> {t('m04.mtr.sme')}</span>}{mentor?.khnp_paired && <span className="caps">{t('m04.mtr.khnp')}</span>}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {a.status === 'proposed' && a.proposed_by !== me && <><button className="btn-primary btn-sm" onClick={() => setRespond('accept')} data-testid="m04-agreement-accept">{t('m04.mtr.accept')}</button><button className="btn-outline btn-sm" onClick={() => setRespond('decline')}>{t('m04.mtr.returnIt')}</button></>}
                    {(a.status === 'declined' || (a.status === 'proposed' && a.proposed_by === me)) && req && <button className="btn-outline btn-sm" onClick={() => setRevise(true)}>{t('m04.mtr.revise')}</button>}
                    {a.status === 'active' && <button className="btn-primary btn-sm" onClick={() => setLog(true)} data-testid="m04-log-session"><Icon name="plus" size={14} />{t('m04.mtr.logSession')}</button>}
                    {['active', 'closing'].includes(a.status) && !myClosed && <button className="btn-outline btn-sm" onClick={() => setClose(true)} data-testid="m04-close-out">{t('m04.mtr.closeOut')}</button>}
                  </div>
                </div>
                {a.status === 'proposed' && <Callout tone="sim" title={a.proposed_by === me ? t('m04.mtr.waitingOther') : t('m04.mtr.waitingYou')}>{t('m04.mtr.proposedBody')}</Callout>}
                {a.status === 'declined' && <Callout tone="bad" title={t('m04.mtr.returned')}>{a.decline_note ? `“${a.decline_note}”` : t('m04.mtr.returnedBody')}</Callout>}
                {a.status === 'closing' && <Callout title={myClosed ? t('m04.mtr.closingWaiting') : t('m04.mtr.closingYou')}>{t('m04.mtr.closingBody')}</Callout>}
              </Card>

              <Grid cols={4}>
                <StatTile label={t('m04.mtr.period')} value={<span className="text-[15px]">{f.date(a.starts_on)} – {f.date(a.ends_on)}</span>} sub={a.status === 'closed' ? t('m04.mtr.ended') : p.daysLeft >= 0 ? t('m04.mtr.daysLeft', { n: f.num(p.daysLeft) }) : t('m04.mtr.overdue', { n: f.num(-p.daysLeft) })} />
                <StatTile label={t('m04.mtr.cadenceLabel')} value={t(`m04.mtr.cadence.${a.cadence}`)} sub={t('m04.mtr.plannedN', { n: f.num(p.total) })} />
                <StatTile label={t('m04.mtr.sessionsLogged')} value={f.num(sessions.length)} sub={t('m04.mtr.minutesN', { n: f.num(minutes) })} tone={p.state === 'behind' && a.status === 'active' ? 'sim' : undefined} />
                <StatTile label={t('m04.mtr.attainment')} value={a.status === 'closed' && a.attainment_pct != null ? `${f.num(Number(a.attainment_pct))}%` : '—'} sub={a.status === 'closed' ? t('m04.mtr.attainmentSub') : t('m04.mtr.attainmentLater')} />
              </Grid>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <Section title={t('m04.mtr.goals')} description={t('m04.mtr.goalsBody')}>
                  <ol className="space-y-2" data-testid="m04-goals">
                    {a.goals.map((g, i) => {
                      const sk = derived.skillBy.get(g.skill_id);
                      const now = side === 'mentee' ? derived.myLevel.get(g.skill_id) ?? 0 : null;
                      const mr = rating(a.mentee_ratings, g.skill_id);
                      const tr = rating(a.mentor_ratings, g.skill_id);
                      const validated = (a.validated_skill_ids ?? []).includes(g.skill_id);
                      return (
                        <li key={g.skill_id} className="card p-3" data-testid="m04-goal">
                          <div className="flex flex-wrap items-center gap-2"><span className="num text-[12px] text-ink-3">{f.num(i + 1)}.</span><SkillChip skill={sk} sme={!!mentor?.sme && (mentor.sme_skill_ids?.length ? mentor.sme_skill_ids : mentor.skill_ids ?? []).includes(g.skill_id)} />
                            <span className="text-[12.5px] text-ink-2">{t('m04.mtr.targetIs', { level: t(`m04.mtr.level.${g.target_level}`) })}</span>
                            {validated && <span className="caps text-ok" data-testid="m04-goal-validated"><Icon name="check" size={12} /> {t('m04.mtr.validated')}</span>}</div>
                          {g.text && <p className="mt-1 text-[13.5px]">{g.text}</p>}
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-ink-3">
                            {now != null && <span>{t('m04.mtr.yourLevel', { n: f.num(now) })}</span>}
                            <span>{t('m04.mtr.touchedN', { n: f.num(touched.get(g.skill_id) ?? 0) })}</span>
                            {mr != null && <span>{t('m04.mtr.menteeRated', { r: t(`m04.mtr.rating.${mr}`) })}</span>}
                            {tr != null && <span>{t('m04.mtr.mentorRated', { r: t(`m04.mtr.rating.${tr}`) })}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Section>
                <Section title={t('m04.mtr.progressTitle')}>
                  <Card>
                    <div className="flex items-center gap-4">
                      <ProgressRing value={p.pct} size={72} tone={p.state === 'behind' ? 'sim' : 'accent'} />
                      <div className="text-[13.5px]">
                        <div className="font-semibold">{t(`m04.mtr.progress.${p.state}`)}</div>
                        <div className="text-ink-2">{t('m04.mtr.progressBody', { n: f.num(sessions.length), due: f.num(p.due), total: f.num(p.total) })}</div>
                      </div>
                    </div>
                    <KeyValue items={[
                      [t('m04.mtr.proposedBy'), a.proposed_by === me ? t('m04.mtr.you') : other],
                      [t('m04.mtr.agreedOn'), a.responded_at && a.status !== 'declined' ? f.date(a.responded_at) : '—'],
                      [t('m04.mtr.request'), req?.message ? `“${req.message}”` : '—'],
                    ]} />
                  </Card>
                  {a.status === 'closed' && (
                    <Card title={t('m04.mtr.closeSummary')} className="mt-4">
                      <p className="text-[13.5px] text-ink-2">{t('m04.mtr.closeSummaryBody', { pct: f.num(Number(a.attainment_pct ?? attainmentPct(a.mentee_ratings, a.mentor_ratings) ?? 0)), met: t(`m04.mtr.rating.${MET}`) })}</p>
                      {a.mentee_note && <p className="mt-2 text-[13px]"><b>{t('m04.mtr.menteeSaid')}</b> “{a.mentee_note}”</p>}
                      {a.mentor_note && <p className="mt-1 text-[13px]"><b>{t('m04.mtr.mentorSaid')}</b> “{a.mentor_note}”</p>}
                      {(a.validated_skill_ids ?? []).length > 0 && <p className="mt-2 text-[13px] text-ok"><Icon name="check" size={13} /> {t('m04.mtr.validatedSummary', { n: f.num((a.validated_skill_ids ?? []).length) })}</p>}
                    </Card>
                  )}
                </Section>
              </div>

              <Section title={t('m04.mtr.sessions')} description={t('m04.mtr.sessionsBody')}>
                {sessions.length === 0 ? <EmptyState icon="calendar" title={t('m04.mtr.noSessions')}>{a.status === 'active' ? t('m04.mtr.noSessionsBody') : null}</EmptyState> : (
                  <div data-testid="m04-sessions">
                    <Timeline items={sessions.map((s) => ({
                      id: s.id, tone: 'accent',
                      when: `${f.date(s.held_on)} · ${t('m04.mtr.minutesN', { n: f.num(Number(s.minutes ?? 0)) })} · ${s.logged_by === me ? t('m04.mtr.loggedByYou') : t('m04.mtr.loggedByOther')}`,
                      title: s.topics || t('m04.mtr.sessionUntitled'),
                      detail: (
                        <div className="mt-1 space-y-1">
                          <div className="flex flex-wrap gap-1">{(s.skill_ids ?? []).map((k) => <SkillChip key={k} skill={derived.skillBy.get(k)} />)}</div>
                          {s.note_shared && <p>{s.note_shared}</p>}
                          {notes.has(s.id) && <p className="rounded border border-line bg-sunken px-2 py-1 text-[12.5px]" data-testid="m04-private-note"><Icon name="lock" size={12} /> <span className="caps">{t('m04.mtr.privateOnly')}</span> {notes.get(s.id)}</p>}
                        </div>
                      ),
                    }))} />
                  </div>
                )}
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-3"><Icon name="lock" size={13} />{t('m04.mtr.privacy')}</p>
              </Section>

              {log && <LogSessionModal a={a} skills={derived.skillBy} onClose={() => setLog(false)} />}
              {close && <CloseOutModal a={a} side={side} mentor={mentor} skills={derived.skillBy} onClose={() => setClose(false)} />}
              {revise && req && <ProposeModal request={req} mentor={mentor} current={a} skills={derived.skillBy} onClose={() => setRevise(false)} />}
              <ConfirmDialog open={!!respond} onClose={() => setRespond(null)} title={t(respond === 'decline' ? 'm04.mtr.returnTitle' : 'm04.mtr.acceptTitle')}
                consequence={t(respond === 'decline' ? 'm04.mtr.returnConsequence' : 'm04.mtr.acceptConsequence')}
                onConfirm={async () => { if (respond) await run(() => repo.rpc.respondAgreement(a.id, respond, declineNote.trim() || undefined)); setDeclineNote(''); }}>
                {respond === 'decline' && <TextArea label={t('m04.mtr.returnNote')} name="decline" rows={2} value={declineNote} onChange={setDeclineNote} />}
              </ConfirmDialog>
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

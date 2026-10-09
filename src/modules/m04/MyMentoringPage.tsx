// /my/mentoring (M04 · F13 Mentoring 2.0, extending the G2 opt-in mentor offers). Skills-based suggestions ranked by the F02 kernel
// with reasons ("Why this?"), five mentoring types, requests, agreements with skill goals, session logs and close-outs. People still
// decide: mentors accept or decline every request, and nobody is ever matched with their own line manager.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Grid, Card, Async, EmptyState, ConfirmDialog, Modal, FilterBar, useFilters, Callout, Icon, SelectField, TextArea, TextField, CheckboxField, useForm, required, maxLen, numberRange, Tabs, StatTile, WhyThis, EngineBadge, useReasonText } from '../../ui';
import { useSession } from '../../auth/session';
import type { Reason } from '../../domain/engines/types';
import { useAction, useRepo } from '../../data';
import { useFormat, usePick, useT, hasKey } from '../../i18n';
import { Chip, G2Pill, usePeople } from './ui';
import { useMentoring, type Mentor, type Request } from './useMentoring';
import { rankMentors } from './match';
import { MENTORING_TYPES, MENTOR_LEVEL, freePlaces, type MentoringType } from './mentoring';
import { AgreementRow, ProposeModal, RequestModal, SkillChip, TypeChip } from './mentoringUi';

export default function MyMentoringPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const { q, me, eng, derived, person } = useMentoring();
  const [params] = useSearchParams();
  const focusMentor = params.get('mentor');
  const [tab, setTab] = useState('suggested');
  const [ask, setAsk] = useState<Mentor | null>(null);
  const [propose, setPropose] = useState<Request | null>(null);
  const [respond, setRespond] = useState<{ r: Request; decision: 'matched' | 'declined' | 'closed' } | null>(null);
  const [offer, setOffer] = useState(false);
  const [type, setType] = useState<MentoringType | ''>('');
  const [focus, setFocus] = useState<string[]>([]);

  return (
    <Page title={t('m04.routes.my-mentoring.title')} intro={t('m04.mtr.intro')} wide
      actions={<><EngineBadge engine={eng} /><button className="btn-outline btn-sm" onClick={() => setOffer(true)} data-testid="m04-mentor-offer"><Icon name="users" size={14} />{t('m04.mentor.offer')}</button></>}>
      <Async state={q} isEmpty={() => false}>
        {(d) => {
          if (!derived) return null;
          const roleTitle = (id: string | null | undefined) => pick(d.roles.find((r) => r.id === id), 'title') || '';
          const mentorLabel = (m: Mentor | undefined) => (m ? roleTitle(m.role_id) || people.name(m.person_id) : t('m04.mentor.anyMentor'));
          const mine = d.mentors.find((m) => m.person_id === me) ?? null;
          const myRequests = d.requests.filter((r) => r.person_id === me);
          const toMe = d.requests.filter((r) => r.mentor_person_id === me && r.person_id !== me);
          const asMentee = d.agreements.filter((a) => a.person_id === me && a.status !== 'declined');
          const asMentor = d.agreements.filter((a) => a.mentor_person_id === me && a.status !== 'declined');
          const agreementFor = (reqId: string) => d.agreements.find((a) => a.request_id === reqId);
          const open = d.agreements.filter((a) => a.person_id === me && ['proposed', 'active', 'closing'].includes(a.status)).map((a) => a.mentor_id);
          const match = rankMentors({
            me: me ?? '', roleId: person?.job_role_id ?? null, targets: d.targets, have: derived.have, roleComps: d.roleComps as never, competencies: d.comps as never, roles: d.roles as never,
            skills: d.skills, mentors: d.mentors, requests: d.requests, openWithMentorIds: open, lineManager: d.line.line_manager, chain: d.line.chain, type, focusSkillIds: focus, weights: eng.weights,
          });
          const gapSkills = d.skills.filter((s) => match.needs.some((n) => n.key === s.competency_id) && s.area !== 'security' && (derived.myLevel.get(s.id) ?? 0) < MENTOR_LEVEL).slice(0, 12);
          const ownManager = match.excluded.find((x) => x.code === 'own_manager');
          const waiting = toMe.filter((r) => r.status === 'requested').length;
          const proposedToMe = d.agreements.filter((a) => a.status === 'proposed' && a.proposed_by !== me && (a.person_id === me || a.mentor_person_id === me));
          const ranked = focusMentor ? [...match.ranked].sort((a, b) => (a.id === focusMentor ? -1 : b.id === focusMentor ? 1 : 0)) : match.ranked;
          const label = (a: (typeof d.agreements)[number]) => (a.person_id === me ? mentorLabel(derived.mentorBy.get(a.mentor_id)) : people.name(a.person_id));
          return (
            <div className="space-y-6">
              <Grid cols={4}>
                <StatTile label={t('m04.mtr.tileMentee')} value={f.num(asMentee.filter((a) => ['active', 'closing'].includes(a.status)).length)} sub={t('m04.mtr.tileMenteeSub')} />
                <StatTile label={t('m04.mtr.tileMentor')} value={f.num(asMentor.filter((a) => ['active', 'closing'].includes(a.status)).length)} sub={mine ? t('m04.mentor.capacity', { n: f.num(freePlaces(mine, d.requests)), cap: f.num(mine.capacity) }) : t('m04.mtr.notMentor')} />
                <StatTile label={t('m04.mtr.tileWaiting')} value={f.num(waiting + proposedToMe.length)} tone={waiting + proposedToMe.length ? 'info' : undefined} sub={t('m04.mtr.tileWaitingSub')} />
                <StatTile label={t('m04.mtr.tileSessions')} value={f.num(d.sessions.length)} sub={t('m04.mtr.tileSessionsSub')} />
              </Grid>
              {proposedToMe.length > 0 && (
                <Callout tone="sim" title={t('m04.mtr.proposedToYou', { n: f.num(proposedToMe.length) })}>
                  <ul className="mt-1 space-y-1">{proposedToMe.map((a) => <li key={a.id}><a className="link" href={`#${a.id}`} onClick={(e) => { e.preventDefault(); setTab('mine'); }}>{label(a)}</a> · {t(`m04.mtr.type.${a.mentoring_type}`)}</li>)}</ul>
                </Callout>
              )}
              <Tabs value={tab} onChange={setTab} tabs={[
                {
                  id: 'suggested', label: t('m04.mtr.tabSuggested'), badge: match.ranked.length, content: (
                    <div className="space-y-4">
                      <Callout title={t('m04.mtr.humanTitle')}>{t('m04.mtr.humanBody')}</Callout>
                      <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
                        <SelectField label={t('m04.mtr.typeLabel')} name="type" value={type} onChange={(v) => setType(v as MentoringType | '')} placeholder={t('m04.mtr.anyType')} options={MENTORING_TYPES.map((x) => ({ value: x, label: t(`m04.mtr.type.${x}`) }))} />
                        <fieldset>
                          <legend className="mb-1 text-[13px] font-semibold">{t('m04.mtr.focusLabel')}</legend>
                          <div className="flex flex-wrap gap-1.5" data-testid="m04-focus-skills">
                            {gapSkills.length === 0 && <span className="text-[12.5px] text-ink-3">{t('m04.mtr.noGaps')}</span>}
                            {gapSkills.map((s) => (
                              <button key={s.id} type="button" aria-pressed={focus.includes(s.id)} onClick={() => setFocus((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : cur.length >= 5 ? cur : [...cur, s.id]))}
                                className={`rounded-full border px-2.5 py-1 text-[12.5px] ${focus.includes(s.id) ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line text-ink-2'}`}>{pick(s, 'name')}</button>
                            ))}
                          </div>
                        </fieldset>
                      </div>
                      {ownManager && <p className="flex items-center gap-2 text-[12.5px] text-ink-3" data-testid="m04-own-manager-note"><Icon name="info" size={14} />{t('m04.mtr.ownManagerNote', { role: mentorLabel(ownManager.mentor) })}</p>}
                      {ranked.length === 0 ? <EmptyState icon="users" title={t('m04.mtr.noMatches')}>{t('m04.mtr.noMatchesBody')}</EmptyState> : (
                        <ol className="grid gap-3 lg:grid-cols-2" data-testid="m04-mentor-matches">
                          {ranked.slice(0, 10).map((r, i) => {
                            const m = r.item!.mentor;
                            return (
                              <li key={r.id} className={`card flex flex-col p-4 ${r.id === focusMentor ? 'ring-2 ring-accent' : ''}`} data-testid="m04-match-card" data-mentor={m.id}>
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-eyebrow" aria-hidden><Icon name={m.sme ? 'shield' : 'users'} size={18} /></div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2"><span className="num text-[12px] text-ink-3">{f.num(i + 1)}.</span><h3 className="font-semibold">{mentorLabel(m)}</h3>
                                      {m.sme && <span className="caps text-eyebrow" data-testid="m04-sme-badge">{t('m04.mtr.sme')}</span>}{m.khnp_paired && <span className="caps">{t('m04.mtr.khnp')}</span>}</div>
                                    <p className="mt-1 text-[13px] text-ink-2">{pick(m, 'bio')}</p>
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">{(m.types ?? []).map((x) => <TypeChip key={x} type={x} />)}</div>
                                <div className="mt-2 flex flex-wrap gap-1">{(m.skill_ids ?? []).map((s) => <SkillChip key={s} skill={derived.skillBy.get(s)} sme={!!m.sme && (m.sme_skill_ids?.length ? m.sme_skill_ids : m.skill_ids ?? []).includes(s)} />)}</div>
                                <p className="mt-2 text-[13px] text-ink-2" data-testid="m04-top-reason">{r.reasons[0] ? <ReasonLine r={r.reasons[0]} /> : null}</p>
                                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                                  <WhyThis reasons={r.reasons} />
                                  <div className="flex items-center gap-2"><span className="text-[12.5px] text-ink-3">{t('m04.mentor.capacity', { n: f.num(r.item!.free), cap: f.num(m.capacity) })}</span>
                                    <button className="btn-primary btn-sm" onClick={() => setAsk(m)} data-testid="m04-mentor-request">{t('m04.mentor.request')}</button></div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {match.full.length > 0 && <p className="text-[12.5px] text-ink-3">{t('m04.mtr.fullNote', { n: f.num(match.full.length) })}</p>}
                    </div>
                  ),
                },
                {
                  id: 'mine', label: t('m04.mtr.tabMine'), badge: asMentee.length + myRequests.filter((r) => ['requested', 'matched'].includes(r.status)).length, content: (
                    <div className="space-y-6" data-testid="m04-mentoring-mine">
                      <Section title={t('m04.mtr.agreementsAsMentee')}>
                        {asMentee.length === 0 ? <p className="text-ink-3">{t('m04.mtr.noAgreements')}</p> : <ul className="space-y-2">{asMentee.map((a) => <AgreementRow key={a.id} a={a} me={me} label={label(a)} sessions={d.sessions} />)}</ul>}
                      </Section>
                      <Section title={t('m04.mentor.myRequests')}>
                        {myRequests.length === 0 ? <p className="text-ink-3">{t('m04.mentor.noRequests')}</p> : (
                          <ul className="divide-y divide-line rounded-card border border-line" data-testid="m04-my-requests">
                            {myRequests.map((r) => {
                              const m = r.mentor_id ? derived.mentorBy.get(r.mentor_id) : undefined;
                              const ag = agreementFor(r.id);
                              return (
                                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{mentorLabel(m)}</span>{r.mentoring_type && <TypeChip type={r.mentoring_type} />}</div>
                                    <div className="text-[12.5px] text-ink-3">{f.date(r.created_at)}{(r.skill_ids ?? []).length > 0 && ` · ${(r.skill_ids ?? []).map((s) => (derived.skillBy.get(s) ? pick(derived.skillBy.get(s)!, 'name') : s)).join(', ')}`}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <G2Pill status={r.status} />
                                    {r.status === 'matched' && (!ag || ag.status === 'declined') && <button className="btn-primary btn-sm" onClick={() => setPropose(r)} data-testid="m04-propose">{t('m04.mtr.propose')}</button>}
                                    {['requested', 'matched'].includes(r.status) && !(ag && ['active', 'closing'].includes(ag.status)) && <button className="btn-ghost btn-sm" onClick={() => setRespond({ r, decision: 'closed' })}>{t('m04.mentor.close')}</button>}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </Section>
                    </div>
                  ),
                },
                {
                  id: 'give', label: t('m04.mtr.tabGive'), badge: waiting || undefined, content: (
                    <div className="space-y-6">
                      <Section title={t('m04.mentor.toMe', { n: f.num(waiting) })}>
                        {toMe.length === 0 ? <p className="text-ink-3">{t('m04.mtr.noIncoming')}</p> : (
                          <div className="space-y-2" data-testid="m04-mentor-inbox">
                            {toMe.map((r) => {
                              const ag = agreementFor(r.id);
                              return (
                                <Card key={r.id} title={people.name(r.person_id)} eyebrow={r.mentoring_type ? t(`m04.mtr.type.${r.mentoring_type}`) : t('m04.mentor.interest', { i: r.interest })} actions={<G2Pill status={r.status} />}>
                                  {(r.skill_ids ?? []).length > 0 && <div className="mb-1 flex flex-wrap gap-1">{(r.skill_ids ?? []).map((s) => <SkillChip key={s} skill={derived.skillBy.get(s)} />)}</div>}
                                  {r.message && <p className="text-[13.5px] text-ink-2">“{r.message}”</p>}
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {r.status === 'requested' && <><button className="btn-primary btn-sm" onClick={() => setRespond({ r, decision: 'matched' })} data-testid="m04-mentor-accept">{t('m04.mentor.accept')}</button><button className="btn-outline btn-sm" onClick={() => setRespond({ r, decision: 'declined' })}>{t('m04.mentor.decline')}</button></>}
                                    {r.status === 'matched' && (!ag || ag.status === 'declined') && <button className="btn-primary btn-sm" onClick={() => setPropose(r)}>{t('m04.mtr.propose')}</button>}
                                    {r.status === 'matched' && !(ag && ['active', 'closing'].includes(ag.status)) && <button className="btn-ghost btn-sm" onClick={() => setRespond({ r, decision: 'closed' })}>{t('m04.mentor.close')}</button>}
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </Section>
                      <Section title={t('m04.mtr.agreementsAsMentor')}>
                        {asMentor.length === 0 ? <p className="text-ink-3">{t('m04.mtr.noAgreements')}</p> : <ul className="space-y-2">{asMentor.map((a) => <AgreementRow key={a.id} a={a} me={me} label={label(a)} sessions={d.sessions} />)}</ul>}
                      </Section>
                      <Section title={t('m04.mtr.myOffer')} actions={<button className="btn-outline btn-sm" onClick={() => setOffer(true)}>{mine ? t('m04.mentor.editOffer') : t('m04.mentor.offer')}</button>}>
                        {!mine ? <p className="text-ink-3">{t('m04.mtr.noOffer')}</p> : (
                          <Card title={roleTitle(mine.role_id) || t('m04.mtr.myOffer')} eyebrow={mine.opt_in ? t('m04.mentor.optIn') : t('m04.mtr.paused')}>
                            <p className="text-[13.5px] text-ink-2">{pick(mine, 'bio')}</p>
                            <div className="mt-2 flex flex-wrap gap-1">{(mine.types ?? []).map((x) => <TypeChip key={x} type={x} />)}</div>
                            <div className="mt-2 flex flex-wrap gap-1">{(mine.skill_ids ?? []).map((s) => <SkillChip key={s} skill={derived.skillBy.get(s)} sme={!!mine.sme && (mine.sme_skill_ids?.length ? mine.sme_skill_ids : mine.skill_ids ?? []).includes(s)} />)}</div>
                            {mine.sme && <p className="mt-2 text-[12.5px] text-eyebrow"><Icon name="shield" size={13} /> {t('m04.mtr.youAreSme', { date: f.date(mine.sme_nominated_on ?? null) })}</p>}
                          </Card>
                        )}
                      </Section>
                    </div>
                  ),
                },
                { id: 'browse', label: t('m04.mtr.tabBrowse'), content: <Browse mentors={d.mentors.filter((m) => m.opt_in && m.person_id !== me && m.person_id !== d.line.line_manager)} requests={d.requests} roleTitle={roleTitle} me={me} onAsk={setAsk} /> },
              ]} />

              {ask && <RequestModal mentor={ask} roleTitle={mentorLabel(ask)} skills={derived.skillBy} defaultType={type} defaultSkills={focus.length ? focus : match.ranked.find((x) => x.id === ask.id)?.item?.gapSkills} onClose={() => setAsk(null)} />}
              {propose && <ProposeModal request={propose} mentor={propose.mentor_id ? derived.mentorBy.get(propose.mentor_id) : undefined} current={agreementFor(propose.id)} skills={derived.skillBy} onClose={() => setPropose(null)} />}
              {offer && <OfferModal mine={mine} roles={d.roles.map((r) => ({ value: r.id, label: pick(r, 'title') }))} skills={d.skills.filter((s) => s.area !== 'security' && (derived.myLevel.get(s.id) ?? 0) >= MENTOR_LEVEL)} onClose={() => setOffer(false)} />}
              <ConfirmDialog open={!!respond} onClose={() => setRespond(null)} title={t(`m04.mentor.${respond?.decision ?? 'closed'}Title`)} consequence={t(`m04.mentor.${respond?.decision ?? 'closed'}Body`)}
                onConfirm={async () => { if (respond) await run(() => repo.rpc.respondMentoring(respond.r.id, respond.decision)); }} />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function ReasonLine({ r }: { r: Reason }) {
  const text = useReasonText();
  return <>{text(r)}</>;
}

function Browse({ mentors, requests, roleTitle, me, onAsk }: { mentors: Mentor[]; requests: Request[]; roleTitle: (id: string | null | undefined) => string; me: string | null; onAsk: (m: Mentor) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [flt, setFlt] = useFilters({ q: '', type: '', role: '' });
  const openWith = new Set(requests.filter((r) => r.person_id === me && ['requested', 'matched'].includes(r.status)).map((r) => r.mentor_id));
  const term = flt.q.trim().toLowerCase();
  const list = mentors.filter((m) => (!flt.type || (m.types ?? []).includes(flt.type)) && (!flt.role || m.role_id === flt.role)
    && (!term || `${roleTitle(m.role_id)} ${(m.interests ?? []).join(' ')} ${m.bio_en} ${m.bio_ar}`.toLowerCase().includes(term)));
  return (
    <div className="space-y-3">
      <FilterBar value={flt} onChange={setFlt} search="q" fields={[
        { key: 'type', label: t('m04.mtr.typeLabel'), options: MENTORING_TYPES.map((x) => ({ value: x, label: t(`m04.mtr.type.${x}`) })) },
        { key: 'role', label: t('m04.mentor.fRole'), options: [...new Set(mentors.map((m) => m.role_id).filter(Boolean))].map((id) => ({ value: id!, label: roleTitle(id) })) },
      ]} />
      {list.length === 0 ? <EmptyState icon="users" title={t('m04.mentor.none')} /> : (
        <Grid cols={3}>
          {list.map((m) => {
            const free = freePlaces(m, requests);
            return (
              <Card key={m.id} as="article" title={roleTitle(m.role_id) || t('m04.mentor.optIn')} eyebrow={m.sme ? t('m04.mtr.sme') : t('m04.mentor.optIn')} footer={t('m04.mentor.capacity', { n: f.num(free), cap: f.num(m.capacity) })}>
                <p className="text-[13.5px] text-ink-2">{pick(m, 'bio')}</p>
                <div className="mt-2 flex flex-wrap gap-1">{(m.types ?? []).map((x) => <TypeChip key={x} type={x} />)}</div>
                <div className="mt-2 flex flex-wrap gap-1">{(m.interests ?? []).map((i) => <Chip key={i}>{tagLabel(t, i)}</Chip>)}</div>
                <button className="btn-primary btn-sm mt-3" disabled={free === 0 || openWith.has(m.id)} onClick={() => onAsk(m)}>{openWith.has(m.id) ? t('m04.mentor.alreadyAsked') : t('m04.mentor.request')}</button>
              </Card>
            );
          })}
        </Grid>
      )}
    </div>
  );
}

function OfferModal({ mine, roles, skills, onClose }: { mine: Mentor | null; roles: { value: string; label: string }[]; skills: { id: string; name_en: string; name_ar: string }[]; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useMentoringSession();
  const [optIn, setOptIn] = useState(mine?.opt_in ?? true);
  const [types, setTypes] = useState<string[]>(mine?.types?.length ? mine.types : ['career']);
  const [offered, setOffered] = useState<string[]>((mine?.skill_ids ?? []).slice(0, 8));
  const form = useForm({ role: mine?.role_id ?? s.roleId ?? '', interests: (mine?.interests ?? []).join(', '), capacity: String(mine?.capacity ?? 2), bio_en: mine?.bio_en ?? '', bio_ar: mine?.bio_ar ?? '' },
    { interests: [maxLen(200)], capacity: [required(), numberRange(1, 5)], bio_en: [required(), maxLen(300)], bio_ar: [required(), maxLen(300)] });
  const interests = useMemo(() => form.values.interests.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean), [form.values.interests]);
  const skillOptions = [...new Map([...skills, ...((mine?.skill_ids ?? []).map((id) => ({ id, name_en: id, name_ar: id })))].map((x) => [x.id, x])).values()];
  return (
    <Modal open onClose={onClose} size="lg" title={mine ? t('m04.mentor.editOffer') : t('m04.mentor.offer')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m04-offer-form" disabled={form.submitting || !types.length}>{t('common.save')}</button></>}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m04.mtr.offerBody')}</p>
      <form id="m04-offer-form" className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (v) => {
        const row = { role_id: v.role || null, interests, capacity: Number(v.capacity), opt_in: optIn, bio_en: v.bio_en.trim(), bio_ar: v.bio_ar.trim(), types, skill_ids: offered };
        const r = mine ? await run(() => repo.update('mentors', mine.id, row as never), { success: t('m04.mentor.offerSaved') }) : await run(() => repo.insert('mentors', { ...row, person_id: s.me! } as never), { success: t('m04.mentor.offerSaved') });
        if (r.ok) onClose();
      })}>
        <SelectField label={t('m04.mentor.fRole')} options={roles} {...form.field('role')} />
        <TextField label={t('m04.mentor.capacityLabel')} type="number" required {...form.field('capacity')} />
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[13px] font-semibold">{t('m04.mtr.offerTypes')}</legend>
          <div className="flex flex-wrap gap-3">{MENTORING_TYPES.map((x) => <CheckboxField key={x} label={t(`m04.mtr.type.${x}`)} checked={types.includes(x)} onChange={(on) => setTypes((cur) => (on ? [...cur, x] : cur.filter((y) => y !== x)))} />)}</div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-[13px] font-semibold">{t('m04.mtr.offerSkills')}</legend>
          <p className="mb-1 text-[12px] text-ink-3">{t('m04.mtr.offerSkillsHint')}</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {skillOptions.length === 0 && <span className="text-[12.5px] text-ink-3">{t('m04.mtr.offerNoSkills')}</span>}
            {skillOptions.map((sk) => (
              <label key={sk.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] ${offered.includes(sk.id) ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={offered.includes(sk.id)} onChange={() => setOffered((cur) => (cur.includes(sk.id) ? cur.filter((x) => x !== sk.id) : cur.length >= 8 ? cur : [...cur, sk.id]))} />{pick(sk, 'name')}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2"><TextField label={t('m04.mentor.interestsLabel')} hint={t('m04.mentor.interestsHint')} {...form.field('interests')} /></div>
        <TextArea label={t('m04.mentor.bioEn')} required rows={3} {...form.field('bio_en')} />
        <TextArea label={t('m04.mentor.bioAr')} required rows={3} {...form.field('bio_ar')} />
        <div className="sm:col-span-2"><CheckboxField label={t('m04.mentor.optInLabel')} hint={t('m04.mentor.optInHint')} checked={optIn} onChange={setOptIn} /></div>
        {mine?.sme && <p className="sm:col-span-2 text-[12.5px] text-ink-3"><Icon name="shield" size={13} /> {t('m04.mtr.smeReadOnly')}</p>}
      </form>
    </Modal>
  );
}

function useMentoringSession() {
  const s = useSession();
  return { me: s.identity.personId, roleId: s.person?.job_role_id ?? null };
}

/** Interest tags are free text; the common ones have translations (key: lower case, spaces as underscores). */
function tagLabel(t: (k: string) => string, tag: string): string {
  const key = `m04.mentor.tags.${tag.trim().toLowerCase().replace(/\s+/g, '_')}`;
  return hasKey(key) ? t(key) : tag;
}

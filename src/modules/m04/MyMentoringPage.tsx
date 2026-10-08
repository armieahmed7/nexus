// /my/mentoring (M04): opt-in mentor matching by role and interest. Human matching only: no algorithm ranks or scores people.
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, ConfirmDialog, Modal, FilterBar, useFilters, Callout, Icon, SelectField, TextArea, TextField, CheckboxField, useForm, required, maxLen, numberRange } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { MentorsRow, MentoringRequestsRow } from '../../data/types';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Chip, G2Pill, usePeople } from './ui';

export default function MyMentoringPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const people = usePeople();
  const me = s.identity.personId;
  const q = useQuery(['mentors', 'mentoring_requests', 'job_roles'], async () => {
    const [mentors, requests, roles] = await Promise.all([repo.list('mentors'), repo.list('mentoring_requests', { order: [['created_at', 'desc']] }), repo.list('job_roles')]);
    return { mentors, requests, roles };
  }, []);
  const [flt, setFlt] = useFilters({ q: '', interest: '', role: '' });
  const [ask, setAsk] = useState<MentorsRow | null>(null);
  const [respond, setRespond] = useState<{ r: MentoringRequestsRow; decision: 'matched' | 'declined' | 'closed' } | null>(null);
  const [offer, setOffer] = useState(false);

  return (
    <Page title={t('m04.routes.my-mentoring.title')} intro={t('m04.mentor.intro')} actions={<button className="btn-outline btn-sm" onClick={() => setOffer(true)} data-testid="m04-mentor-offer"><Icon name="users" size={14} />{t('m04.mentor.offer')}</button>}>
      <Callout title={t('m04.mentor.humanTitle')}>{t('m04.mentor.humanBody')}</Callout>
      <Async state={q} isEmpty={() => false}>
        {(d) => {
          const roleTitle = (id: string | null | undefined) => pick(d.roles.find((r) => r.id === id), 'title') || '—';
          const mine = d.mentors.find((m) => m.person_id === me);
          const myRequests = d.requests.filter((r) => r.person_id === me);
          const toMe = d.requests.filter((r) => r.mentor_person_id === me && r.person_id !== me);
          const openWith = new Set(myRequests.filter((r) => ['requested', 'matched'].includes(r.status)).map((r) => r.mentor_id));
          const interests = [...new Set(d.mentors.flatMap((m) => m.interests ?? []))].sort();
          const term = flt.q.trim().toLowerCase();
          const list = d.mentors.filter((m) => m.opt_in && m.person_id !== me && (!flt.interest || (m.interests ?? []).includes(flt.interest)) && (!flt.role || m.role_id === flt.role)
            && (!term || `${roleTitle(m.role_id)} ${(m.interests ?? []).join(' ')} ${m.bio_en} ${m.bio_ar}`.toLowerCase().includes(term)));
          const load = (m: MentorsRow) => d.requests.filter((r) => r.mentor_id === m.id && r.status === 'matched').length;
          return (
            <div className="space-y-6">
              {toMe.length > 0 && (
                <Section title={t('m04.mentor.toMe', { n: f.num(toMe.filter((r) => r.status === 'requested').length) })}>
                  <div className="space-y-2" data-testid="m04-mentor-inbox">
                    {toMe.map((r) => (
                      <Card key={r.id} title={people.name(r.person_id)} eyebrow={t('m04.mentor.interest', { i: r.interest })} actions={<G2Pill status={r.status} />}>
                        {r.message && <p className="text-[13.5px] text-ink-2">“{r.message}”</p>}
                        {r.status === 'requested' && <div className="mt-2 flex gap-2"><button className="btn-primary btn-sm" onClick={() => setRespond({ r, decision: 'matched' })} data-testid="m04-mentor-accept">{t('m04.mentor.accept')}</button><button className="btn-outline btn-sm" onClick={() => setRespond({ r, decision: 'declined' })}>{t('m04.mentor.decline')}</button></div>}
                        {r.status === 'matched' && <button className="btn-ghost btn-sm mt-2" onClick={() => setRespond({ r, decision: 'closed' })}>{t('m04.mentor.close')}</button>}
                      </Card>
                    ))}
                  </div>
                </Section>
              )}

              <Section title={t('m04.mentor.myRequests')}>
                {myRequests.length === 0 ? <p className="text-ink-3">{t('m04.mentor.noRequests')}</p> : (
                  <ul className="divide-y divide-line rounded-card border border-line">
                    {myRequests.map((r) => { const m = d.mentors.find((x) => x.id === r.mentor_id); return (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                        <div><div className="font-semibold">{m ? roleTitle(m.role_id) : t('m04.mentor.anyMentor')}</div><div className="text-[12.5px] text-ink-3">{t('m04.mentor.interest', { i: r.interest })} · {f.date(r.created_at)}</div></div>
                        <div className="flex items-center gap-2"><G2Pill status={r.status} />{['requested', 'matched'].includes(r.status) && <button className="btn-ghost btn-sm" onClick={() => setRespond({ r, decision: 'closed' })}>{t('m04.mentor.close')}</button>}</div>
                      </li>
                    ); })}
                  </ul>
                )}
              </Section>

              <Section title={t('m04.mentor.find')}>
                <FilterBar value={flt} onChange={setFlt} search="q" fields={[
                  { key: 'interest', label: t('m04.mentor.fInterest'), options: interests.map((i) => ({ value: i, label: i })) },
                  { key: 'role', label: t('m04.mentor.fRole'), options: [...new Set(d.mentors.map((m) => m.role_id).filter(Boolean))].map((id) => ({ value: id!, label: roleTitle(id) })) },
                ]} />
                {list.length === 0 ? <EmptyState icon="users" title={t('m04.mentor.none')} /> : (
                  <Grid cols={3}>
                    {list.map((m) => {
                      const free = Math.max(0, m.capacity - load(m));
                      return (
                        <Card key={m.id} as="article" title={roleTitle(m.role_id)} eyebrow={t('m04.mentor.optIn')} footer={t('m04.mentor.capacity', { n: f.num(free), cap: f.num(m.capacity) })}>
                          <p className="text-[13.5px] text-ink-2">{pick(m, 'bio')}</p>
                          <div className="mt-2 flex flex-wrap gap-1">{(m.interests ?? []).map((i) => <Chip key={i}>{i}</Chip>)}</div>
                          <button className="btn-primary btn-sm mt-3" disabled={free === 0 || openWith.has(m.id)} onClick={() => setAsk(m)} data-testid="m04-mentor-request">{openWith.has(m.id) ? t('m04.mentor.alreadyAsked') : t('m04.mentor.request')}</button>
                        </Card>
                      );
                    })}
                  </Grid>
                )}
              </Section>

              {ask && <RequestModal mentor={ask} roleTitle={roleTitle(ask.role_id)} onClose={() => setAsk(null)} />}
              {offer && <OfferModal mine={mine ?? null} roles={d.roles.map((r) => ({ value: r.id, label: pick(r, 'title') }))} onClose={() => setOffer(false)} />}
              <ConfirmDialog open={!!respond} onClose={() => setRespond(null)} title={t(`m04.mentor.${respond?.decision ?? 'closed'}Title`)} consequence={t(`m04.mentor.${respond?.decision ?? 'closed'}Body`)}
                onConfirm={async () => { if (respond) await run(() => repo.rpc.respondMentoring(respond.r.id, respond.decision)); }} />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function RequestModal({ mentor, roleTitle, onClose }: { mentor: MentorsRow; roleTitle: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const form = useForm({ interest: mentor.interests?.[0] ?? '', message: '' }, { interest: [required()], message: [maxLen(500)] });
  return (
    <Modal open onClose={onClose} title={t('m04.mentor.requestTitle', { role: roleTitle })} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m04-mr-form" disabled={form.submitting}>{t('m04.mentor.send')}</button></>}>
      <form id="m04-mr-form" className="space-y-3" onSubmit={form.handleSubmit(async (v) => {
        const r = await run(() => repo.insert('mentoring_requests', { person_id: s.identity.personId!, mentor_id: mentor.id, mentor_person_id: mentor.person_id, interest: v.interest, message: v.message.trim(), status: 'requested' }), { success: t('m04.mentor.sent') });
        if (r.ok) onClose();
      })}>
        <SelectField label={t('m04.mentor.fInterest')} required options={(mentor.interests ?? []).map((i) => ({ value: i, label: i }))} {...form.field('interest')} />
        <TextArea label={t('m04.mentor.message')} hint={t('m04.mentor.messageHint')} {...form.field('message')} />
      </form>
    </Modal>
  );
}

function OfferModal({ mine, roles, onClose }: { mine: MentorsRow | null; roles: { value: string; label: string }[]; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [optIn, setOptIn] = useState(mine?.opt_in ?? true);
  const form = useForm({ role: mine?.role_id ?? s.person?.job_role_id ?? '', interests: (mine?.interests ?? []).join(', '), capacity: String(mine?.capacity ?? 2), bio_en: mine?.bio_en ?? '', bio_ar: mine?.bio_ar ?? '' },
    { interests: [required(), maxLen(200)], capacity: [required(), numberRange(1, 5)], bio_en: [required(), maxLen(300)], bio_ar: [required(), maxLen(300)] });
  const interests = useMemo(() => form.values.interests.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean), [form.values.interests]);
  return (
    <Modal open onClose={onClose} size="lg" title={mine ? t('m04.mentor.editOffer') : t('m04.mentor.offer')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m04-offer-form" disabled={form.submitting}>{t('common.save')}</button></>}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m04.mentor.offerBody')}</p>
      <form id="m04-offer-form" className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (v) => {
        const row = { role_id: v.role || null, interests, capacity: Number(v.capacity), opt_in: optIn, bio_en: v.bio_en.trim(), bio_ar: v.bio_ar.trim() };
        const r = mine ? await run(() => repo.update('mentors', mine.id, row), { success: t('m04.mentor.offerSaved') }) : await run(() => repo.insert('mentors', { ...row, person_id: s.identity.personId! }), { success: t('m04.mentor.offerSaved') });
        if (r.ok) onClose();
      })}>
        <SelectField label={t('m04.mentor.fRole')} options={roles} {...form.field('role')} />
        <TextField label={t('m04.mentor.capacityLabel')} type="number" required {...form.field('capacity')} />
        <div className="sm:col-span-2"><TextField label={t('m04.mentor.interestsLabel')} hint={t('m04.mentor.interestsHint')} required {...form.field('interests')} /></div>
        <TextArea label={t('m04.mentor.bioEn')} required rows={3} {...form.field('bio_en')} />
        <TextArea label={t('m04.mentor.bioAr')} required rows={3} {...form.field('bio_ar')} />
        <div className="sm:col-span-2"><CheckboxField label={t('m04.mentor.optInLabel')} hint={t('m04.mentor.optInHint')} checked={optIn} onChange={setOptIn} /></div>
      </form>
    </Modal>
  );
}

// /communities/experts (M22 · F17): the expert finder. Search by skill; results are only people who opted in, with their current
// level 3 or above on the skills they listed (role, team and evidence basis; no contact details), ranked with reasons. Contact
// happens through an in-app request. My own opt-in card and my requests (sent and received) are on the same page.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Modal, WhyThis, EngineBadge, Icon, Tabs, CheckboxField, ConfirmDialog } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { EXPERT_MIN_LEVEL, rankExperts, type ExpertRow } from './domain';
import { useLabels, M22Pill, LevelDots } from './ui';
import { ReserveExpertsNote } from '../m20/ReserveExpertsNote'; // W3 integration: F23 alumni experts who opted into the finder

export default function ExpertsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const [skill, setSkill] = useState('');
  const base = useQuery(['skills', 'job_roles', 'person_skills', 'expert_optin', 'expert_requests'], async () => {
    const [skills, roles, states, optin, requests] = await Promise.all([
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      me ? repo.list('person_skills', { filter: { person_id: me, active: true } }).catch(() => []) : Promise.resolve([]),
      me ? repo.list('expert_optin', { filter: { person_id: me } }).catch(() => []) : Promise.resolve([]),
      repo.list('expert_requests', { order: [['created_at', 'desc']] }).catch(() => []),
    ]);
    return { skills: skills.filter((x) => x.area !== 'security'), roles, states, mine: optin[0] ?? null, requests };
  }, [me]);
  const experts = useQuery(['expert_optin', 'person_skills'], () => repo.rpc.findExperts(skill || null), [skill, me]);
  return (
    <Page title={t('m22.routes.communities-experts.title')} intro={t('m22.experts.intro')} eyebrow={<L to="/communities">{t('m22.cop.back')}</L>} wide>
      <ReserveExpertsNote skillId={skill || null} />
      <Async state={base}>
        {(b) => (
          <Tabs tabs={[
            { id: 'find', label: t('m22.experts.tabFind'), content: <Find b={b} skill={skill} setSkill={setSkill} experts={experts} me={me} /> },
            { id: 'me', label: t('m22.experts.tabMe'), content: <MyOptin b={b} /> },
            { id: 'requests', label: t('m22.experts.tabRequests'), badge: b.requests.filter((r) => r.expert_id === me && r.status === 'sent').length ? <span className="chip border-info-line bg-info-bg text-info">{b.requests.filter((r) => r.expert_id === me && r.status === 'sent').length}</span> : undefined, content: <Requests b={b} me={me} /> },
          ]} />
        )}
      </Async>
    </Page>
  );
}
type Base = { skills: import('../../data').RowOf<'skills'>[]; roles: import('../../data').RowOf<'job_roles'>[]; states: import('../../data').RowOf<'person_skills'>[]; mine: import('../../data').RowOf<'expert_optin'> | null; requests: import('../../data').RowOf<'expert_requests'>[] };

function Find({ b, skill, setSkill, experts, me }: { b: Base; skill: string; setSkill: (s: string) => void; experts: ReturnType<typeof useQuery<ExpertRow[]>>; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const eng = useEngine('match');
  const lab = useLabels(b.skills, b.roles);
  const [ask, setAsk] = useState<{ e: ExpertRow; skill: string } | null>(null);
  const ranked = useMemo(() => rankExperts(experts.data ?? [], skill || null, lab.skillBi), [experts.data, skill, lab]);
  void me;
  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[240px] flex-1">
          <span className="caps">{t('m22.experts.skill')}</span>
          <select className="input mt-1" value={skill} onChange={(e) => setSkill(e.target.value)} data-testid="m22-expert-skill">
            <option value="">{t('m22.experts.anySkill')}</option>
            {b.skills.map((s) => <option key={s.id} value={s.id}>{pick(s, 'name')}</option>)}
          </select>
        </label>
        <EngineBadge engine={eng} />
      </div>
      <Async state={experts} isEmpty={() => ranked.length === 0} empty={<EmptyState icon="search" title={t('m22.experts.none')}>{t('m22.experts.noneBody')}</EmptyState>}>
        {() => (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m22-experts">
            {ranked.map((r) => {
              const e = r.item!;
              const top = skill ? e.skills.find((x) => x.skill_id === skill)! : e.skills[0];
              return (
                <li key={e.person_id} className="card flex flex-col p-4" data-testid="m22-expert">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{pick({ name_en: e.name, name_ar: e.name_ar }, 'name')}</div>
                      <div className="text-[12.5px] text-ink-2">{lab.role(e.role_id)}{e.team_id ? ` · ${e.team_id}` : ''}</div>
                    </div>
                    <WhyThis reasons={r.reasons} testId="m22-expert-why" />
                  </div>
                  {e.headline && <p className="mt-2 text-[13px]">{e.headline}</p>}
                  <ul className="mt-2 space-y-1">
                    {e.skills.map((s) => (
                      <li key={s.skill_id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                        <span className={s.skill_id === skill ? 'font-semibold' : ''}>{lab.skill(s.skill_id)}</span>
                        <span className="flex items-center gap-2"><LevelDots level={s.level} label={t('m22.common.level', { n: s.level })} /><span className="text-ink-3">{t(`m22.basis.${s.basis}`)}</span></span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-3"><button className="btn-outline btn-sm" onClick={() => setAsk({ e, skill: top.skill_id })} data-testid="m22-expert-ask"><Icon name="chat" size={14} />{t('m22.experts.ask')}</button></div>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <p className="text-[12px] text-ink-3">{t('m22.experts.note', { n: f.num(EXPERT_MIN_LEVEL) })}</p>
      <AskModal ask={ask} onClose={() => setAsk(null)} skillLabel={ask ? lab.skill(ask.skill) : ''} />
    </div>
  );
}

function AskModal({ ask, onClose, skillLabel }: { ask: { e: ExpertRow; skill: string } | null; onClose: () => void; skillLabel: string }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!ask} onClose={() => !busy && onClose()} title={ask ? t('m22.experts.askTitle', { name: pick({ name_en: ask.e.name, name_ar: ask.e.name_ar }, 'name') }) : ''}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={busy || msg.trim().length < 10} data-testid="m22-expert-send" onClick={async () => {
          setBusy(true);
          try { const r = await run(() => repo.rpc.requestExpert(ask!.e.person_id, ask!.skill, msg.trim())); if (r.ok) { setMsg(''); onClose(); } } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m22.experts.send')}</button>
      </>}>
      <div className="space-y-3">
        <p className="text-[13px] text-ink-2">{t('m22.experts.askAbout', { skill: skillLabel })}</p>
        <label className="block"><span className="caps">{t('m22.experts.message')}</span><textarea className="input mt-1" rows={4} maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} data-testid="m22-expert-message" /></label>
        <Callout>{t('m22.experts.inApp')}</Callout>
      </div>
    </Modal>
  );
}

function MyOptin({ b }: { b: Base }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const eligible = b.states.filter((s) => s.level >= EXPERT_MIN_LEVEL && b.skills.some((k) => k.id === s.skill_id));
  const [sel, setSel] = useState<string[]>(b.mine?.skill_ids ?? []);
  const [headline, setHeadline] = useState(b.mine?.headline ?? '');
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const label = (id: string) => pick(b.skills.find((s) => s.id === id), 'name');
  return (
    <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={t('m22.experts.optinTitle')} actions={b.mine ? <span className={`chip ${b.mine.visible ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-2'}`}>{t(b.mine.visible ? 'm22.experts.listed' : 'm22.experts.hidden')}</span> : <span className="chip border-line bg-sunken text-ink-2">{t('m22.experts.notListed')}</span>}>
        {eligible.length === 0 ? <EmptyState icon="info" title={t('m22.experts.noEligible')}>{t('m22.experts.noEligibleBody', { n: EXPERT_MIN_LEVEL })}</EmptyState> : (
          <div className="space-y-3" data-testid="m22-optin">
            <p className="text-[13px] text-ink-2">{t('m22.experts.optinBody', { n: EXPERT_MIN_LEVEL })}</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {eligible.map((s) => <CheckboxField key={s.skill_id} label={`${label(s.skill_id)} · ${t('m22.common.level', { n: s.level })}`} checked={sel.includes(s.skill_id)} onChange={(v) => setSel((x) => (v ? [...x, s.skill_id].slice(0, 8) : x.filter((y) => y !== s.skill_id)))} />)}
            </div>
            <label className="block"><span className="caps">{t('m22.experts.headline')}</span><input className="input mt-1" maxLength={140} value={headline} onChange={(e) => setHeadline(e.target.value)} data-testid="m22-optin-headline" /></label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary btn-sm" disabled={!sel.length} onClick={() => setConfirm(true)} data-testid="m22-optin-save">{t('m22.experts.list')}</button>
              {b.mine?.visible && <button className="btn-outline btn-sm" onClick={() => setConfirm(false)} data-testid="m22-optin-hide">{t('m22.experts.hide')}</button>}
            </div>
          </div>
        )}
      </Card>
      <Callout title={t('m22.experts.privacyTitle')}>{t('m22.experts.privacyBody')}</Callout>
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? t('m22.experts.listTitle') : t('m22.experts.hideTitle')} consequence={confirm ? t('m22.experts.listBody') : t('m22.experts.hideBody')} confirmLabel={confirm ? t('m22.experts.list') : t('m22.experts.hide')}
        onConfirm={async () => { await run(() => repo.rpc.setExpertOptin(confirm ? sel : (b.mine?.skill_ids ?? []), !!confirm, headline.trim())); }} />
    </div>
  );
}

function Requests({ b, me }: { b: Base; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const lab = useLabels(b.skills, b.roles);
  const [reply, setReply] = useState<{ id: string; decision: 'accepted' | 'declined' } | null>(null);
  const [text, setText] = useState('');
  const received = b.requests.filter((r) => r.expert_id === me);
  const sent = b.requests.filter((r) => r.requester_id === me);
  const Item = ({ r, mode }: { r: Base['requests'][number]; mode: 'in' | 'out' }) => (
    <li className="card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{mode === 'in' ? pick({ name_en: r.requester_name, name_ar: r.requester_name_ar }, 'name') : pick({ name_en: r.expert_name, name_ar: r.expert_name_ar }, 'name')}</span>
        <M22Pill kind="request" status={r.status} />
      </div>
      <div className="text-[12.5px] text-ink-2">{lab.skill(r.skill_id)} · {f.date(r.created_at)}</div>
      <p className="mt-1 text-[13px]">“{r.message}”</p>
      {r.reply && <p className="mt-1 text-[12.5px] text-ink-2">{t('m22.experts.replyWas', { reply: r.reply })}</p>}
      {mode === 'in' && r.status === 'sent' && (
        <div className="mt-2 flex gap-2">
          <button className="btn-primary btn-sm" onClick={() => { setText(''); setReply({ id: r.id, decision: 'accepted' }); }} data-testid="m22-request-accept">{t('m22.experts.accept')}</button>
          <button className="btn-outline btn-sm" onClick={() => { setText(''); setReply({ id: r.id, decision: 'declined' }); }}>{t('m22.experts.decline')}</button>
        </div>
      )}
    </li>
  );
  return (
    <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
      <Section title={t('m22.experts.received')}>{received.length ? <ul className="space-y-2" data-testid="m22-requests-in">{received.map((r) => <Item key={r.id} r={r} mode="in" />)}</ul> : <EmptyState icon="chat" title={t('m22.experts.noneReceived')} />}</Section>
      <Section title={t('m22.experts.sent')}>{sent.length ? <ul className="space-y-2" data-testid="m22-requests-out">{sent.map((r) => <Item key={r.id} r={r} mode="out" />)}</ul> : <EmptyState icon="chat" title={t('m22.experts.noneSent')} />}</Section>
      <Modal open={!!reply} onClose={() => setReply(null)} title={reply?.decision === 'accepted' ? t('m22.experts.accept') : t('m22.experts.decline')}
        footer={<>
          <button className="btn-outline" onClick={() => setReply(null)}>{t('common.cancel')}</button>
          <button className="btn-primary" data-testid="m22-request-answer" onClick={async () => { if (reply) { const r = await run(() => repo.rpc.answerExpertRequest(reply.id, reply.decision, text.trim())); if (r.ok) setReply(null); } }}>{t('m22.experts.sendAnswer')}</button>
        </>}>
        <label className="block"><span className="caps">{t('m22.experts.replyLabel')}</span><textarea className="input mt-1" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <p className="mt-2 text-[12px] text-ink-3">{t('m22.experts.replyHint')}</p>
      </Modal>
    </div>
  );
}

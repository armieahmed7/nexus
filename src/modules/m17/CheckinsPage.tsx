// F10 /my/skills/checkins: Skill check-ins. Ask my line manager (and up to two same-team peers) to validate up to five
// self-rated skills; follow my check-ins (self, peer and manager answers, outcome); answer the ratings colleagues asked of me.
// Peers see only the skills named for them, never my self levels, my other skills or other raters' answers (RLS + RPC).
// Qualification-standard skills are "verified by qualification only" and security competencies are status only.
import { useMemo, useState } from 'react';
import { Page, Async, Card, Callout, ConfirmDialog, EmptyState, Tabs, TextArea, CheckboxField, Icon, StatusPill } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useT, useFormat, usePick, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { securityComps } from './badgeRules';
import { BasisChip } from './ui';
import { CHECKIN, checkinBlock, isOverdue, type CheckinSkill } from './checkins';
import { CheckinStatus, LevelDots, LevelPicker, OutcomePill, PersonName, useCatalogue, useName, useSkillName, type Catalogue } from './ciUi';
import { Stat } from './ui';
import type { CheckinPeers, InboxItem } from './backend/rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function CheckinsPage() {
  const t = useT();
  const s = useSession();
  const me = s.identity.personId;
  const repo = useRepo();
  const cat = useCatalogue();
  const q = useQuery(['skill_checkins', 'skill_ratings', 'person_skills', 'skill_evidence', 'skill_claims'], async () => {
    if (!me) throw new Error('no person');
    const [checkins, ratings, states, evidence, peers, inbox, claims] = await Promise.all([
      repo.list('skill_checkins', { filter: { person_id: me }, order: [['requested_at', 'desc']] }) as Promise<Row[]>,
      repo.list('skill_ratings', { filter: { subject_id: me } }) as Promise<Row[]>,
      repo.list('person_skills', { filter: { person_id: me, active: true } }) as Promise<Row[]>,
      repo.list('skill_evidence', { filter: { person_id: me, active: true } }) as Promise<Row[]>,
      repo.rpc.checkinPeers(),
      repo.rpc.checkinInbox(),
      repo.list('skill_claims', { filter: { person_id: me, status: 'claimed' } }).catch(() => []) as Promise<Row[]>,
    ]);
    return { checkins, ratings, states, evidence, peers, inbox, claims };
  }, [me]);
  return (
    <Page title={t('m17.routes.my-skills-checkins.title')} intro={t('m17.ci.intro')} actions={<L to="/my/skills" className="btn-outline btn-sm no-underline">{t('m17.ci.toPassport')}</L>}>
      <Async state={{ data: q.data && cat.data ? { ...q.data, cat: cat.data } : undefined, loading: q.loading || cat.loading, error: q.error ?? cat.error, reload: q.reload }}>
        {(d) => <Checkins d={d} me={me!} />}
      </Async>
    </Page>
  );
}

interface Data { checkins: Row[]; ratings: Row[]; states: Row[]; evidence: Row[]; peers: CheckinPeers; inbox: InboxItem[]; claims: Row[]; cat: Catalogue }

function Checkins({ d, me }: { d: Data; me: string }) {
  const t = useT();
  const f = useFormat();
  const today = todayIso();
  const open = d.checkins.filter((c) => c.status === 'open');
  const waiting = d.inbox.filter((i) => i.status === 'open' && i.items.some((x) => x.status === 'pending'));
  const validatedLevels = d.checkins.flatMap((c) => (c.skills ?? []) as CheckinSkill[]).filter((s) => s.outcome === 'validate' || s.outcome === 'adjust').length;
  const [tab, setTab] = useState(waiting.length ? 'asked' : 'mine');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m17-ci-stats">
        <Stat label={t('m17.ci.stat.open')} value={f.num(open.length)} sub={open.some((c) => isOverdue(c, today)) ? t('m17.ci.stat.overdue') : t('m17.ci.stat.openSub')} tone={open.some((c) => isOverdue(c, today)) ? 'bad' : 'info'} />
        <Stat label={t('m17.ci.stat.decided')} value={f.num(d.checkins.filter((c) => c.status === 'validated' || c.status === 'adjusted').length)} />
        <Stat label={t('m17.ci.stat.levels')} value={f.num(validatedLevels)} sub={t('m17.ci.stat.levelsSub')} tone="ok" />
        <Stat label={t('m17.ci.stat.asked')} value={f.num(waiting.length)} sub={t('m17.ci.stat.askedSub')} tone={waiting.length ? 'sim' : undefined} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'mine', label: t('m17.ci.tab.mine'), badge: open.length ? f.num(open.length) : undefined, content: <MyCheckins d={d} me={me} onNew={() => setTab('new')} /> },
        { id: 'new', label: t('m17.ci.tab.new'), content: <NewCheckin d={d} me={me} onDone={() => setTab('mine')} /> },
        { id: 'asked', label: t('m17.ci.tab.asked'), badge: waiting.length ? f.num(waiting.length) : undefined, content: <AskedOfMe d={d} /> },
      ]} />
    </div>
  );
}

// ───────────── my check-ins
function MyCheckins({ d, me, onNew }: { d: Data; me: string; onNew: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const name = useName();
  const sk = useSkillName(d.cat);
  const repo = useRepo();
  const act = useAction();
  const today = todayIso();
  const [withdraw, setWithdraw] = useState<Row | null>(null);
  const people = new Map([...(d.peers.manager ? [d.peers.manager] : []), ...d.peers.peers].map((p) => [p.id, p]));
  const who = (id: string) => (people.has(id) ? name(people.get(id)!) : id === me ? t('m17.ci.you') : t('m17.ci.colleague'));
  if (!d.checkins.length)
    return <EmptyState title={t('m17.ci.emptyTitle')} action={<button type="button" className="btn-primary" onClick={onNew}>{t('m17.ci.startFirst')}</button>}>{t('m17.ci.empty')}</EmptyState>;
  return (
    <div className="space-y-3" data-testid="m17-ci-mine">
      {d.checkins.map((c) => {
        const rs = d.ratings.filter((r) => r.checkin_id === c.id);
        const overdue = isOverdue(c, today);
        return (
          <Card key={c.id} title={<span className="flex flex-wrap items-center gap-2">{t('m17.ci.requestedOn', { date: f.date(c.requested_at) })} <CheckinStatus status={c.status} overdue={overdue} /></span>}
            eyebrow={c.status === 'open' ? t('m17.ci.dueOn', { date: f.date(c.due_on) }) : c.decided_at ? t('m17.ci.decidedOn', { date: f.date(c.decided_at) }) : undefined}
            actions={c.status === 'open' ? <button type="button" className="btn-ghost btn-sm" onClick={() => setWithdraw(c)} data-testid="m17-ci-withdraw">{t('m17.ci.withdraw')}</button> : undefined}>
            <p className="mb-2 text-[13px] text-ink-2">{t('m17.ci.raters', { manager: who(c.manager_id), n: f.num((c.peer_ids ?? []).length) })}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-start">
                    <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.skill')}</th>
                    <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.self')}</th>
                    <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.peers')}</th>
                    <th scope="col" className="caps py-1.5 text-start">{t('m17.ci.col.manager')}</th>
                  </tr>
                </thead>
                <tbody>
                  {((c.skills ?? []) as CheckinSkill[]).map((s) => {
                    const peers = rs.filter((r) => r.skill_id === s.skill_id && r.rater_kind === 'peer');
                    return (
                      <tr key={s.skill_id} className="border-b border-line/60 align-top">
                        <th scope="row" className="py-2 pe-3 text-start font-medium">{sk(s.skill_id)}<div className="text-[12px] font-normal text-ink-3">{s.note}</div></th>
                        <td className="py-2 pe-3"><LevelDots level={s.self_level} tone="sim" /></td>
                        <td className="space-y-1 py-2 pe-3">
                          {!peers.length && <span className="text-[12px] text-ink-3">{t('m17.ci.noPeers')}</span>}
                          {peers.map((p) => (
                            <div key={p.id} className="text-[12px]">
                              <span className="text-ink-2">{who(p.rater_person_id)}: </span>
                              {p.status === 'submitted' ? <><LevelDots level={p.level} tone="info" /> <span className="text-ink-3">“{p.example}”</span></> : <StatusPill tone="neutral">{t(`m17.ci.rstatus.${p.status}`)}</StatusPill>}
                            </div>
                          ))}
                        </td>
                        <td className="py-2">
                          {s.outcome ? (
                            <div className="space-y-1">
                              <OutcomePill outcome={s.outcome} />
                              {s.final_level != null && <div><LevelDots level={s.final_level} tone="ok" /></div>}
                              {s.reason && <div className="text-[12px] text-ink-3">{s.reason}</div>}
                            </div>
                          ) : <StatusPill tone="neutral">{t(c.status === 'withdrawn' ? 'm17.ci.rstatus.closed' : 'm17.ci.rstatus.pending')}</StatusPill>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {c.decision_note && <p className="mt-2 text-[12px] text-ink-2">{c.decision_note}</p>}
          </Card>
        );
      })}
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m17.ci.withdrawTitle')} consequence={t('m17.ci.withdrawBody')} confirmLabel={t('m17.ci.withdraw')} danger
        onConfirm={async () => { await act(() => repo.rpc.withdrawCheckin(withdraw.id, null)); setWithdraw(null); }} />
      <p className="text-[12px] text-ink-3">{t('m17.ci.privacy')}</p>
    </div>
  );
}

// ───────────── new check-in
function NewCheckin({ d, me, onDone }: { d: Data; me: string; onDone: () => void }) {
  const t = useT();
  const pick = usePick();
  const name = useName();
  const repo = useRepo();
  const act = useAction();
  const f = useFormat();
  const [chosen, setChosen] = useState<string[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [peers, setPeers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState('');
  const sec = useMemo(() => securityComps(d.cat.comps), [d.cat.comps]);
  const std = useMemo(() => new Set(d.cat.standards.map((s) => String(s.id))), [d.cat.standards]);
  const openSkills = new Set(d.checkins.filter((c) => c.status === 'open').flatMap((c) => (c.skills ?? []).map((s: CheckinSkill) => s.skill_id)));
  const state = new Map(d.states.map((s) => [s.skill_id, s]));
  const claimed = new Map(d.claims.map((c) => [c.skill_id, c]));
  const rows = d.cat.skills.map((s) => ({ s, block: checkinBlock(s, { secComps: sec, standardIds: std, evidence: d.evidence, person: me }), open: openSkills.has(s.id) }));
  const ok = rows.filter((r) => !r.block && !r.open && (!filter || pick(r.s, 'name').toLowerCase().includes(filter.toLowerCase())))
    .sort((a, b) => Number(claimed.has(b.s.id)) - Number(claimed.has(a.s.id)) || Number(state.has(b.s.id)) - Number(state.has(a.s.id)) || a.s.sort - b.s.sort);
  const qualOnly = rows.filter((r) => r.block === 'qualification_only' && state.has(r.s.id));
  const toggle = (id: string) => {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= CHECKIN.MAX_SKILLS ? c : [...c, id]));
    if (!levels[id]) setLevels((l) => ({ ...l, [id]: claimed.get(id)?.level ?? Math.max(1, Math.min(4, Number(state.get(id)?.level ?? 2))) }));
  };
  const valid = chosen.length > 0 && chosen.every((id) => levels[id] >= 1 && (notes[id] ?? '').trim().length >= CHECKIN.NOTE_MIN && (notes[id] ?? '').length <= CHECKIN.NOTE_MAX) && message.length <= CHECKIN.MESSAGE_MAX;
  const open = d.checkins.filter((c) => c.status === 'open').length;
  if (!d.peers.manager) return <Callout tone="bad" title={t('m17.ci.noManagerTitle')}>{t('m17.ci.noManager')}</Callout>;
  if (open >= CHECKIN.OPEN_MAX) return <Callout tone="sim" title={t('m17.ci.openMaxTitle')}>{t('m17.ci.openMax', { n: f.num(CHECKIN.OPEN_MAX) })}</Callout>;
  const submit = async () => {
    const r = await act(() => repo.rpc.requestCheckin({ skills: chosen.map((id) => ({ skill_id: id, self_level: levels[id], note: (notes[id] ?? '').trim() })), peer_ids: peers, message: message.trim() || null }), { success: t('m17.ci.sent') });
    setConfirm(false);
    if (r.ok) { setChosen([]); setNotes({}); setPeers([]); setMessage(''); onDone(); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" data-testid="m17-ci-new">
      <Card title={t('m17.ci.pickTitle')} eyebrow={t('m17.ci.pickEyebrow', { n: f.num(chosen.length), max: f.num(CHECKIN.MAX_SKILLS) })}>
        <label className="mb-2 block">
          <span className="sr-only">{t('common.search')}</span>
          <input className="input w-full" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('m17.ci.filter')} data-testid="m17-ci-filter" />
        </label>
        <ul className="max-h-[420px] space-y-1 overflow-y-auto pe-1" data-testid="m17-ci-skills">
          {ok.map(({ s }) => {
            const st = state.get(s.id);
            return (
              <li key={s.id}>
                <label className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 ${chosen.includes(s.id) ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-sunken'}`}>
                  <input type="checkbox" className="mt-1" checked={chosen.includes(s.id)} onChange={() => toggle(s.id)} disabled={!chosen.includes(s.id) && chosen.length >= CHECKIN.MAX_SKILLS} data-testid={`m17-ci-skill-${s.id}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{pick(s, 'name')}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                      {st ? <><BasisChip basis={st.basis} /><LevelDots level={st.level} /></> : t('m17.ci.noState')}
                      {claimed.has(s.id) && <StatusPill tone="sim">{t('m17.ci.claimPending')}</StatusPill>}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {qualOnly.length > 0 && (
          <details className="mt-3 text-[12px] text-ink-2">
            <summary className="cursor-pointer">{t('m17.ci.qualOnlyTitle', { n: f.num(qualOnly.length) })}</summary>
            <ul className="mt-1 space-y-0.5" data-testid="m17-ci-qualonly">
              {qualOnly.map(({ s }) => <li key={s.id} className="flex items-center gap-1.5"><Icon name="shield" size={12} /> {pick(s, 'name')} · <span className="text-ink-3">{t('m17.ci.qualOnly')}</span></li>)}
            </ul>
          </details>
        )}
        <p className="mt-2 text-[12px] text-ink-3">{t('m17.ci.securityNote')}</p>
      </Card>
      <div className="space-y-4">
        <Card title={t('m17.ci.rateTitle')}>
          {!chosen.length && <p className="text-[13px] text-ink-3">{t('m17.ci.rateEmpty')}</p>}
          <div className="space-y-4">
            {chosen.map((id) => (
              <div key={id} className="rounded-card border border-line p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-medium text-ink">{pick(d.cat.skill.get(id), 'name')}</h3>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => toggle(id)} aria-label={t('m17.ci.remove')}><Icon name="close" size={14} /></button>
                </div>
                <LevelPicker name={`self-${id}`} label={t('m17.ci.selfLevel')} value={levels[id] ?? null} onChange={(v) => setLevels((l) => ({ ...l, [id]: v }))} cat={d.cat} skillId={id} />
                <div className="mt-2">
                  <TextArea name={`note-${id}`} label={t('m17.ci.note')} hint={t('m17.ci.noteHint')} rows={2} value={notes[id] ?? ''} onChange={(v) => setNotes((n) => ({ ...n, [id]: v.slice(0, CHECKIN.NOTE_MAX) }))} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('m17.ci.whoTitle')}>
          <p className="mb-2 text-[13px]"><PersonName name={name(d.peers.manager)} sub={t('m17.ci.lineManager')} /></p>
          <p className="mb-1 text-[13px] font-medium text-ink-2">{t('m17.ci.peersTitle', { max: f.num(CHECKIN.MAX_PEERS) })}</p>
          <p className="mb-2 text-[12px] text-ink-3">{d.peers.basis === 'family' ? t('m17.ci.peersFamily') : t('m17.ci.peersTeam')}</p>
          {!d.peers.peers.length && <p className="text-[12px] text-ink-3">{t('m17.ci.noPeerPool')}</p>}
          <div className="grid gap-1 sm:grid-cols-2" data-testid="m17-ci-peers">
            {d.peers.peers.map((p) => (
              <CheckboxField key={p.id} label={<span>{name(p)} <span className="text-ink-3">· {pick(d.cat.role.get(p.job_role_id ?? ''), 'title')}</span></span>} checked={peers.includes(p.id)}
                disabled={!peers.includes(p.id) && peers.length >= CHECKIN.MAX_PEERS} onChange={(v) => setPeers((cur) => (v ? [...cur, p.id] : cur.filter((x) => x !== p.id)))} />
            ))}
          </div>
          <div className="mt-3">
            <TextArea name="message" label={t('m17.ci.message')} rows={2} value={message} onChange={(v) => setMessage(v.slice(0, CHECKIN.MESSAGE_MAX))} />
          </div>
          <Callout tone="info" title={t('m17.ci.peerPrivacyTitle')}>{t('m17.ci.peerPrivacy')}</Callout>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m17-ci-submit">{t('m17.ci.send')}</button>
          </div>
        </Card>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m17.ci.confirmTitle')} confirmLabel={t('m17.ci.send')} onConfirm={submit}
        consequence={t('m17.ci.confirmBody', { n: f.num(chosen.length), manager: name(d.peers.manager), peers: f.num(peers.length) })} />
    </div>
  );
}

// ───────────── asked of me (peer ratings)
function AskedOfMe({ d }: { d: Data }) {
  const t = useT();
  const f = useFormat();
  const name = useName();
  const pick = usePick();
  if (!d.inbox.length) return <EmptyState title={t('m17.ci.askedEmptyTitle')}>{t('m17.ci.askedEmpty')}</EmptyState>;
  return (
    <div className="space-y-3" data-testid="m17-ci-asked">
      <Callout tone="info" title={t('m17.ci.askedNoteTitle')}>{t('m17.ci.askedNote')}</Callout>
      {d.inbox.map((i) => (
        <Card key={i.checkin_id} title={<PersonName name={name(i.requester)} sub={pick(d.cat.role.get(i.requester.job_role_id ?? ''), 'title')} />}
          eyebrow={t('m17.ci.askedOn', { date: f.date(i.requested_at), due: f.date(i.due_on) })} actions={<CheckinStatus status={i.status} />}>
          {i.message && <p className="mb-2 text-[13px] italic text-ink-2">“{i.message}”</p>}
          <PeerForm item={i} cat={d.cat} />
        </Card>
      ))}
    </div>
  );
}
function PeerForm({ item, cat }: { item: InboxItem; cat: Catalogue }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const sk = useSkillName(cat);
  const [lv, setLv] = useState<Record<string, number | null>>(Object.fromEntries(item.items.map((x) => [x.skill_id, x.status === 'not_observed' ? 0 : x.level])));
  const [ex, setEx] = useState<Record<string, string>>(Object.fromEntries(item.items.map((x) => [x.skill_id, x.example ?? ''])));
  const [confirm, setConfirm] = useState(false);
  const closed = item.status !== 'open';
  const valid = item.items.every((x) => lv[x.skill_id] != null && (lv[x.skill_id] === 0 || ((ex[x.skill_id] ?? '').trim().length >= 3 && (ex[x.skill_id] ?? '').length <= CHECKIN.EXAMPLE_MAX)));
  const done = item.items.every((x) => x.status !== 'pending');
  return (
    <div className="space-y-3">
      {item.items.map((x) => (
        <div key={x.skill_id} className="rounded-card border border-line p-3" data-testid="m17-ci-peer-item">
          <h3 className="mb-2 font-medium text-ink">{sk(x.skill_id)}</h3>
          {closed ? (
            <p className="text-[13px] text-ink-2">{x.status === 'submitted' ? <LevelDots level={x.level} tone="info" /> : t(`m17.ci.rstatus.${x.status}`)} {x.example && <span className="text-ink-3">“{x.example}”</span>}</p>
          ) : (
            <>
              <LevelPicker name={`peer-${item.checkin_id}-${x.skill_id}`} label={t('m17.ci.peerLevel')} value={lv[x.skill_id] ?? null} onChange={(v) => setLv((c) => ({ ...c, [x.skill_id]: v }))} cat={cat} skillId={x.skill_id} allowZero />
              {lv[x.skill_id] !== 0 && (
                <div className="mt-2">
                  <TextArea name={`ex-${x.skill_id}`} label={t('m17.ci.example')} hint={t('m17.ci.exampleHint')} rows={2} value={ex[x.skill_id] ?? ''} onChange={(v) => setEx((c) => ({ ...c, [x.skill_id]: v.slice(0, CHECKIN.EXAMPLE_MAX) }))} />
                </div>
              )}
            </>
          )}
        </div>
      ))}
      {!closed && (
        <div className="flex items-center justify-end gap-2">
          {done && <span className="text-[12px] text-ok">{t('m17.ci.peerSent')}</span>}
          <button type="button" className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m17-ci-rate">{done ? t('m17.ci.updateRatings') : t('m17.ci.sendRatings')}</button>
        </div>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m17.ci.rateConfirmTitle')} consequence={t('m17.ci.rateConfirmBody')} confirmLabel={t('m17.ci.sendRatings')}
        onConfirm={async () => {
          await act(() => repo.rpc.submitRating({ checkin_id: item.checkin_id, ratings: item.items.map((x) => ({ skill_id: x.skill_id, level: Number(lv[x.skill_id] ?? 0), example: lv[x.skill_id] === 0 ? null : (ex[x.skill_id] ?? '').trim() })) }));
          setConfirm(false);
        }} />
    </div>
  );
}

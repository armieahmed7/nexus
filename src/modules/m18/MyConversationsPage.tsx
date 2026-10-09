// M18 /my/career/conversations (F12 Career conversations, employee view). Prepare the six-monthly conversation with the line
// manager of record: a pre-filled agenda built on the server from my own records (passport, shortlist with readiness, roadmap,
// expiring qualifications, coach progress; I choose what to include), my aspirations, mobility and goals; share it; read what my
// manager recorded and acknowledge it (disagreeing with a comment if needed). Agreed actions land in my development plan as
// draft activities; I decide whether the focus role and weekly hours go to the Learning Coach and whether talent review may see
// my aspiration. Drafts stay private until shared.
import { useEffect, useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatusPill, StatTile, Grid, Stepper, Tabs, Timeline, ConfirmDialog, TextArea, RadioGroup, CheckboxField, Icon } from '../../ui';
import { useQuery, useRepo, type QueryState } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { ASPIRATIONS, MOBILITY, LEADERSHIP, SUPPORT, MAX_ASPIRATIONS, cadenceOf, heldRecently, type Agenda, type ConvRow, type Prep } from './conversations';
import { ActionList, AgendaView, CadencePill, ConvStatusPill, PrepSummary, asActions, asAgenda, asPrep, useCcAction, useCcCatalogue, type CcCatalogue } from './ccShared';

type Row = ConvRow & { created_at: string; manager_name: string; manager_name_ar: string };
const DEFAULT_PREP: Prep = {
  aspirations: [], mobility: 'current_site', shift_ok: false, rotation_ok: false, leadership: 'not_now', goal_12m: '', goal_3y: '', support: [], support_note: '', topics: '',
  include: { targets: true, roadmap: true, coach: true }, share_with_talent_review: false,
};

export default function MyConversationsPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.person?.id ?? null;
  const rows = useQuery(['career_conversations'], async () => (me ? ((await repo.list('career_conversations', { filter: { person_id: me }, order: [['created_at', 'desc']] })) as unknown as Row[]) : []), [me]);
  const agenda = useQuery(['person_skills', 'career_targets', 'roadmaps', 'learning_goals', 'coach_feedback', 'career_conversations', 'qual_records'], async () => {
    if (!me) return null;
    const r = await repo.rpc.conversationAgenda(me);
    if (!r.ok) throw new Error(r.message);
    return r.data as Agenda;
  }, [me]);
  const cat = useCcCatalogue();
  return (
    <Page title={t('m18.routes.my-career-conversations.title')} intro={t('m18.cc.my.intro')}
      actions={<><L to="/my/career" className="btn-ghost btn-sm">{t('m18.cc.my.toNavigator')}</L><L to="/my/plan" className="btn-outline btn-sm"><Icon name="check" size={14} />{t('m18.cc.my.toPlan')}</L></>}>
      <Async state={rows} isEmpty={() => false}>
        {(list) => (
          <Async state={cat}>
            {(c) => <Body rows={list} me={me!} hire={s.person?.hire_date ?? null} agenda={agenda} cat={c} />}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Body({ rows, me, hire, agenda, cat }: { rows: Row[]; me: string; hire: string | null; agenda: QueryState<Agenda | null>; cat: CcCatalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const today = todayIso();
  const open = rows.find((r) => r.status === 'held') ?? rows.find((r) => r.status === 'draft') ?? null;
  const held = rows.filter((r) => r.status !== 'draft' && r.held_on).sort((a, b) => String(b.held_on).localeCompare(String(a.held_on)) || (a.id < b.id ? -1 : 1));
  const last = held[0] ?? null;
  const cad = cadenceOf(last?.held_on ? String(last.held_on).slice(0, 10) : null, hire, today);
  const step = open?.status === 'held' ? 2 : open?.prep_submitted_at ? 1 : open ? 0 : last && heldRecently(String(last.held_on).slice(0, 10), today) ? 4 : 0;
  const mgrName = open?.manager_name ? pick({ n_en: open.manager_name, n_ar: open.manager_name_ar || open.manager_name }, 'n') : last ? pick({ n_en: last.manager_name, n_ar: last.manager_name_ar || last.manager_name }, 'n') : null;
  const [tab, setTab] = useState('cycle');
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m18.cc.my.next')} value={<span className="text-[17px]">{cad.due_on ? f.date(cad.due_on) : t('m18.cc.my.now')}</span>} tone={cad.state === 'overdue' ? 'bad' : cad.state === 'due_soon' ? 'sim' : 'ok'}
          sub={<CadencePill c={cad} />} />
        <StatTile label={t('m18.cc.my.last')} value={<span className="text-[17px]">{last ? f.date(String(last.held_on)) : '—'}</span>} sub={last ? <ConvStatusPill r={last} /> : t('m18.cc.my.noneYet')} />
        <StatTile label={t('m18.cc.my.manager')} value={<span className="text-[15px]">{mgrName ?? '—'}</span>} sub={t('m18.cc.my.managerSub')} />
        <StatTile label={t('m18.cc.my.talent')} value={<span className="text-[15px]">{last?.share_with_talent_review ? t('m18.cc.my.on') : t('m18.cc.my.off')}</span>} sub={t('m18.cc.my.talentSub')} />
      </Grid>
      <Card className="mt-4">
        <Stepper current={step} steps={['prepare', 'share', 'held', 'ack'].map((id) => ({ id, label: t(`m18.cc.step.${id}`) }))} />
      </Card>
      <div className="mt-4"><Callout tone="info" title={t('m18.cc.privacy.title')}>{t('m18.cc.privacy.body')}</Callout></div>
      <div className="mt-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'cycle', label: t('m18.cc.tab.cycle'), content: open?.status === 'held' ? <Acknowledge row={open} cat={cat} /> : <Prepare open={open} last={last} agenda={agenda} cat={cat} /> },
          { id: 'history', label: t('m18.cc.tab.history'), badge: held.length ? f.num(held.length) : undefined, content: <History rows={held} cat={cat} /> },
        ]} />
      </div>
    </>
  );
}

// ───────────── preparation
function Prepare({ open, last, agenda, cat }: { open: Row | null; last: Row | null; agenda: QueryState<Agenda | null>; cat: CcCatalogue }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useCcAction();
  const initial = useMemo<Prep>(() => {
    const base = open?.status === 'draft' ? asPrep(open.prep) : asPrep(last?.prep);
    return { ...DEFAULT_PREP, ...base, include: { ...DEFAULT_PREP.include, ...(base.include ?? {}) }, share_with_talent_review: open?.share_with_talent_review ?? false } as Prep;
  }, [open, last]);
  const [p, setP] = useState<Prep>(initial);
  useEffect(() => setP(initial), [initial]);
  const [confirm, setConfirm] = useState(false);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Prep>(k: K, v: Prep[K]) => setP((x) => ({ ...x, [k]: v }));
  const toggleAsp = (a: Prep['aspirations'][number]) => setP((x) => ({ ...x, aspirations: x.aspirations.includes(a) ? x.aspirations.filter((y) => y !== a) : x.aspirations.length >= MAX_ASPIRATIONS ? x.aspirations : [...x.aspirations, a] }));
  const toggleSup = (sup: string) => setP((x) => ({ ...x, support: x.support.includes(sup) ? x.support.filter((y) => y !== sup) : SUPPORT.filter((z) => z === sup || x.support.includes(z)) }));
  const ready = p.aspirations.length > 0 && p.goal_12m.trim().length >= 3;
  const shared = !!open?.prep_submitted_at;
  const save = (submit: boolean) => run(() => repo.rpc.submitPrep(p, submit), submit ? t('m18.cc.prep.sharedOk') : t('m18.cc.prep.savedOk'));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <Section title={t('m18.cc.agenda.title')} description={t('m18.cc.agenda.desc')}>
          <Async state={agenda}>{(a) => (a ? <AgendaView a={a} cat={cat} include={p.include} onInclude={(k, v) => setP((x) => ({ ...x, include: { ...x.include, [k]: v } }))} mine /> : null)}</Async>
        </Section>
      </div>
      <div className="xl:col-span-3">
        <Section title={t('m18.cc.prep.title')} description={t('m18.cc.prep.desc')}>
          <Card>
            {shared && <div className="mb-3"><Callout tone="ok" title={t('m18.cc.prep.sharedTitle', { date: f.date(String(open!.prep_submitted_at)) })}>{t('m18.cc.prep.sharedBody')}</Callout></div>}
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()} data-testid="m18-cc-prep-form">
              <fieldset>
                <legend className="mb-1 text-[13px] font-semibold">{t('m18.cc.prep.aspirations')}</legend>
                <p className="mb-2 text-[12px] text-ink-3">{t('m18.cc.prep.aspHint', { n: f.num(MAX_ASPIRATIONS) })}</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('m18.cc.prep.aspirations')}>
                  {ASPIRATIONS.map((a) => {
                    const i = p.aspirations.indexOf(a);
                    return (
                      <button key={a} type="button" aria-pressed={i >= 0} onClick={() => toggleAsp(a)} data-testid="m18-cc-asp" data-asp={a}
                        className={`rounded-card border px-3 py-2 text-start text-[13px] ${i >= 0 ? 'border-accent bg-accent-soft' : 'border-line bg-panel hover:border-line-strong'}`}>
                        <span className="block font-semibold">{t(`m18.cc.asp.${a}`)}{i === 0 && <span className="ms-1.5 text-[11px] font-normal text-eyebrow">{t('m18.cc.prep.primary')}</span>}</span>
                        <span className="block text-[11.5px] text-ink-3">{t(`m18.cc.aspHint.${a}`)}</span>
                      </button>
                    );
                  })}
                </div>
                {tried && p.aspirations.length === 0 && <p className="mt-1 text-[12px] text-bad" role="alert">{t('m18.cc.prep.needAsp')}</p>}
              </fieldset>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RadioGroup label={t('m18.cc.prep.mobility')} name="mobility" value={p.mobility} onChange={(v) => set('mobility', v as Prep['mobility'])} options={MOBILITY.map((m) => ({ value: m, label: t(`m18.cc.mob.${m}`) }))} />
                <RadioGroup label={t('m18.cc.prep.leadership')} name="leadership" value={p.leadership} onChange={(v) => set('leadership', v as Prep['leadership'])} options={LEADERSHIP.map((m) => ({ value: m, label: t(`m18.cc.lead.${m}`) }))} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <CheckboxField label={t('m18.cc.prep.shiftOk')} checked={p.shift_ok} onChange={(v) => set('shift_ok', v)} />
                <CheckboxField label={t('m18.cc.prep.rotationOk')} hint={t('m18.cc.prep.rotationHint')} checked={p.rotation_ok} onChange={(v) => set('rotation_ok', v)} />
              </div>
              <TextArea label={t('m18.cc.prep.goal12')} name="goal_12m" rows={2} value={p.goal_12m} onChange={(v) => set('goal_12m', v.slice(0, 500))} hint={t('m18.cc.prep.goal12Hint')} required error={tried && p.goal_12m.trim().length < 3 ? 'm18.cc.prep.needGoal' : null} />
              <TextArea label={t('m18.cc.prep.goal3')} name="goal_3y" rows={2} value={p.goal_3y} onChange={(v) => set('goal_3y', v.slice(0, 500))} />
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold">{t('m18.cc.prep.support')}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {SUPPORT.map((sup) => <CheckboxField key={sup} label={t(`m18.cc.support.${sup}`)} checked={p.support.includes(sup)} onChange={() => toggleSup(sup)} />)}
                </div>
              </fieldset>
              <TextArea label={t('m18.cc.prep.supportNote')} name="support_note" rows={2} value={p.support_note} onChange={(v) => set('support_note', v.slice(0, 500))} />
              <TextArea label={t('m18.cc.prep.topics')} name="topics" rows={2} value={p.topics} onChange={(v) => set('topics', v.slice(0, 500))} />
              <div className="rounded-card border border-line bg-raised p-3">
                <CheckboxField label={t('m18.cc.prep.shareTalent')} hint={t('m18.cc.prep.shareTalentHint')} checked={p.share_with_talent_review} onChange={(v) => set('share_with_talent_review', v)} />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <button type="button" className="btn-outline" onClick={() => save(false)} data-testid="m18-cc-save">{t('m18.cc.prep.save')}</button>
                <button type="button" className="btn-primary" onClick={() => { setTried(true); if (ready) setConfirm(true); }} data-testid="m18-cc-share">
                  <Icon name="users" size={14} />{shared ? t('m18.cc.prep.update') : t('m18.cc.prep.share')}
                </button>
                <span className="text-[12px] text-ink-3">{shared ? t('m18.cc.prep.updateHint') : t('m18.cc.prep.saveHint')}</span>
              </div>
            </form>
          </Card>
        </Section>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m18.cc.prep.confirmTitle')} consequence={t('m18.cc.prep.confirmBody')} confirmLabel={shared ? t('m18.cc.prep.update') : t('m18.cc.prep.share')}
        onConfirm={async () => { const r = await save(true); if (r.ok) setConfirm(false); }} />
    </div>
  );
}

// ───────────── acknowledgement (only the employee)
function Acknowledge({ row, cat }: { row: Row; cat: CcCatalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useCcAction();
  const [agree, setAgree] = useState('agree');
  const [comment, setComment] = useState('');
  const [coach, setCoach] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [tried, setTried] = useState(false);
  const needComment = agree === 'disagree' && comment.trim().length < 3;
  const a = asAgenda(row.agenda);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5" data-testid="m18-cc-ack-view">
      <div className="space-y-4 xl:col-span-3">
        <Card title={t('m18.cc.held.title', { date: f.date(String(row.held_on)) })} eyebrow={t('m18.cc.held.by', { name: pick({ n_en: row.manager_name, n_ar: row.manager_name_ar || row.manager_name }, 'n') })}>
          <div className="space-y-4">
            <div><h3 className="caps mb-1">{t('m18.cc.held.notes')}</h3><p className="whitespace-pre-line text-[13.5px]" data-testid="m18-cc-notes">{row.notes || '—'}</p></div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              {row.focus_role_id && <StatusPill tone="accent">{t('m18.cc.held.focus', { role: pick(cat.roleById.get(row.focus_role_id), 'title') })}</StatusPill>}
              {row.coach_hours != null && <StatusPill tone="info">{t('m18.cc.held.hours', { n: f.num(Number(row.coach_hours)) })}</StatusPill>}
            </div>
            <div><h3 className="caps mb-1">{t('m18.cc.held.actions')}</h3><ActionList actions={asActions(row.actions)} cat={cat} planLink={!!row.plan_id} /></div>
          </div>
        </Card>
        <Card title={t('m18.cc.ack.title')}>
          <div className="space-y-3" data-testid="m18-cc-ack-form">
            <RadioGroup label={t('m18.cc.ack.question')} name="agree" value={agree} onChange={setAgree} options={[{ value: 'agree', label: t('m18.cc.ack.agree') }, { value: 'disagree', label: t('m18.cc.ack.disagree') }]} />
            <TextArea label={agree === 'disagree' ? t('m18.cc.ack.commentNeeded') : t('m18.cc.ack.comment')} name="comment" rows={3} value={comment} onChange={(v) => setComment(v.slice(0, 1000))} required={agree === 'disagree'} error={tried && needComment ? 'm18.cc.ack.needComment' : null} />
            {(row.focus_role_id || row.coach_hours != null) && <CheckboxField label={t('m18.cc.ack.coach')} hint={t('m18.cc.ack.coachHint')} checked={coach} onChange={setCoach} />}
            <button type="button" className="btn-primary" onClick={() => { setTried(true); if (!needComment) setConfirm(true); }} data-testid="m18-cc-ack"><Icon name="check" size={14} />{t('m18.cc.ack.button')}</button>
          </div>
        </Card>
      </div>
      <div className="xl:col-span-2">
        <Section title={t('m18.cc.held.prep')}><Card><PrepSummary p={asPrep(row.prep)} /></Card></Section>
        {a && <Section title={t('m18.cc.held.agenda')}><AgendaView a={a} cat={cat} /></Section>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m18.cc.ack.confirmTitle')} consequence={agree === 'agree' ? t('m18.cc.ack.confirmAgree') : t('m18.cc.ack.confirmDisagree')} confirmLabel={t('m18.cc.ack.button')}
        onConfirm={async () => { const r = await run(() => repo.rpc.acknowledgeConversation(row.id, agree === 'agree', comment, coach), agree === 'agree' ? t('m18.cc.ack.done') : t('m18.cc.ack.doneComment')); if (r.ok) setConfirm(false); }} />
    </div>
  );
}

// ───────────── history and talent-review consent
function History({ rows, cat }: { rows: Row[]; cat: CcCatalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useCcAction();
  const [sel, setSel] = useState<string | null>(rows[0]?.id ?? null);
  const [consent, setConsent] = useState<boolean | null>(null);
  if (!rows.length) return <EmptyState title={t('m18.cc.history.none')} icon="chat">{t('m18.cc.history.noneBody')}</EmptyState>;
  const cur = rows.find((r) => r.id === sel) ?? rows[0];
  const latest = rows[0];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div>
        <Card title={t('m18.cc.history.timeline')}>
          <Timeline items={rows.map((r) => ({
            id: r.id, when: f.date(String(r.held_on)), tone: r.status === 'acknowledged' ? (r.employee_agrees === false ? 'accent' : 'ok') : 'sim',
            title: <button type="button" className={`text-start ${r.id === cur.id ? 'text-accent' : ''}`} onClick={() => setSel(r.id)} data-testid="m18-cc-history-item">{t('m18.cc.history.item', { cycle: r.cycle ?? '' })}</button>,
            detail: <ConvStatusPill r={r} />,
          }))} />
        </Card>
        <Card className="mt-4" title={t('m18.cc.consent.title')}>
          <p className="mb-2 text-[13px] text-ink-2">{t('m18.cc.consent.body')}</p>
          <CheckboxField label={t('m18.cc.prep.shareTalent')} checked={!!latest.share_with_talent_review} onChange={(v) => setConsent(v)} />
          <p className="mt-1 text-[12px] text-ink-3" data-testid="m18-cc-consent-state">{latest.share_with_talent_review ? t('m18.cc.consent.on') : t('m18.cc.consent.off')}</p>
        </Card>
      </div>
      <div className="space-y-4 lg:col-span-2" data-testid="m18-cc-history-detail">
        <Card title={t('m18.cc.held.title', { date: f.date(String(cur.held_on)) })} eyebrow={t('m18.cc.held.by', { name: pick({ n_en: cur.manager_name, n_ar: cur.manager_name_ar || cur.manager_name }, 'n') })} actions={<ConvStatusPill r={cur} />}>
          <div className="space-y-3">
            <PrepSummary p={asPrep(cur.prep)} />
            <div className="border-t border-line pt-3"><h3 className="caps mb-1">{t('m18.cc.held.notes')}</h3><p className="whitespace-pre-line text-[13.5px]">{cur.notes || '—'}</p></div>
            <div><h3 className="caps mb-1">{t('m18.cc.held.actions')}</h3><ActionList actions={asActions(cur.actions)} cat={cat} planLink={!!cur.plan_id} /></div>
            {cur.status === 'acknowledged' && (
              <Callout tone={cur.employee_agrees === false ? 'sim' : 'ok'} title={cur.employee_agrees === false ? t('m18.cc.history.disagreed') : t('m18.cc.history.agreed')}>
                {cur.employee_comment || t('m18.cc.history.noComment')}
              </Callout>
            )}
          </div>
        </Card>
      </div>
      <ConfirmDialog open={consent !== null} onClose={() => setConsent(null)} title={t('m18.cc.consent.title')} consequence={consent ? t('m18.cc.consent.confirmOn') : t('m18.cc.consent.confirmOff')}
        onConfirm={async () => { const r = await run(() => repo.rpc.setAspirationSharing(latest.id, !!consent), consent ? t('m18.cc.consent.doneOn') : t('m18.cc.consent.doneOff')); if (r.ok) setConsent(null); }} />
    </div>
  );
}

// M18 /team/conversations (F12 Career conversations, line manager view). My reports of record (rpc.teamConversations: F08's
// line-manager rule) with the six-monthly cadence, the conversations they shared with me (RLS: manager_read_id), a workspace per
// person: the employee's preparation, the pre-filled agenda (or a preview holding only what they share), deterministic suggested
// actions with reasons, and the record form (notes, focus role, weekly learning hours, agreed actions → draft plan activities).
// Only the employee acknowledges. The reminder sweep notifies both sides of every overdue pair.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, StatusPill, StatTile, Grid, Modal, Tabs, ConfirmDialog, TextArea, TextField, SelectField, Icon, WhyThis, EngineBadge } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine'; // direct import: avoids a circular chunk warning in the build
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { ACTION_KINDS, ACTION_OWNERS, MAX_ACTIONS, heldRecently, suggestActions, type Action, type Agenda, type ConvRow, type TeamRow } from './conversations';
import { ActionList, AgendaView, CadencePill, ConvStatusPill, PrepSummary, asActions, asAgenda, asPrep, useCcAction, useCcCatalogue, type CcCatalogue } from './ccShared';

type Row = ConvRow & { created_at: string; person_name: string; person_name_ar: string };
const FILTERS = ['all', 'overdue', 'waiting', 'awaiting_ack'] as const;

export default function TeamConversationsPage() {
  const t = useT();
  const repo = useRepo();
  const team = useQuery(['career_conversations', 'notifications'], async () => {
    const r = await repo.rpc.teamConversations();
    if (!r.ok) throw new Error(r.message);
    return r.data ?? [];
  }, []);
  const convs = useQuery('career_conversations', async () => (await repo.list('career_conversations', { order: [['created_at', 'desc']] })) as unknown as Row[], []);
  const cat = useCcCatalogue();
  return (
    <Page title={t('m18.routes.team-conversations.title')} intro={t('m18.cc.team.intro')} actions={<L to="/team/career" className="btn-ghost btn-sm">{t('m18.cc.team.toCareer')}</L>}>
      <Async state={team} isEmpty={() => false}>
        {(tr) => <Async state={convs} isEmpty={() => false}>{(cv) => <Async state={cat}>{(c) => <TeamBody team={tr} convs={cv} cat={c} />}</Async>}</Async>}
      </Async>
    </Page>
  );
}

function TeamBody({ team, convs, cat }: { team: TeamRow[]; convs: Row[]; cat: CcCatalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useCcAction();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [remind, setRemind] = useState(false);
  const sel = params.get('person');
  const today = todayIso();
  const waiting = (x: TeamRow) => x.open?.status === 'draft' && x.open.prep_submitted;
  const awaiting = (x: TeamRow) => x.open?.status === 'held';
  const counts = {
    held: team.filter((x) => heldRecently(x.cadence.last_held_on, today)).length,
    overdue: team.filter((x) => x.cadence.state === 'overdue').length,
    waiting: team.filter(waiting).length,
    awaiting: team.filter(awaiting).length,
  };
  const shown = team.filter((x) => filter === 'all' || (filter === 'overdue' ? x.cadence.state === 'overdue' : filter === 'waiting' ? waiting(x) : awaiting(x)))
    .sort((a, b) => Number(waiting(b)) - Number(waiting(a)) || ['overdue', 'due_soon', 'ok'].indexOf(a.cadence.state) - ['overdue', 'due_soon', 'ok'].indexOf(b.cadence.state) || a.name.localeCompare(b.name));
  const open = (pid: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (pid) n.set('person', pid); else n.delete('person'); return n; }, { replace: true });
  const selRow = team.find((x) => x.person_id === sel) ?? null;
  if (!team.length) return <EmptyState title={t('m18.cc.team.none')} icon="users">{t('m18.cc.team.noneBody')}</EmptyState>;
  return (
    <>
      <Grid cols={4}>
        <StatTile label={t('m18.cc.team.reports')} value={f.num(team.length)} sub={t('m18.cc.team.reportsSub')} />
        <StatTile label={t('m18.cc.team.held')} value={f.pct((counts.held * 100) / Math.max(1, team.length), 0)} tone={counts.held === team.length ? 'ok' : undefined} sub={t('m18.cc.team.heldSub', { n: f.num(counts.held) })} />
        <StatTile label={t('m18.cc.team.overdue')} value={f.num(counts.overdue)} tone={counts.overdue ? 'bad' : 'ok'} sub={t('m18.cc.team.overdueSub')} />
        <StatTile label={t('m18.cc.team.waiting')} value={f.num(counts.waiting)} tone={counts.waiting ? 'info' : undefined} sub={t('m18.cc.team.waitingSub', { n: f.num(counts.awaiting) })} />
      </Grid>
      <Section title={t('m18.cc.team.list')} description={t('m18.cc.team.listDesc')}
        actions={<button className="btn-outline btn-sm" onClick={() => setRemind(true)} data-testid="m18-cc-remind"><Icon name="bell" size={14} />{t('m18.cc.team.remind')}</button>}>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t('m18.cc.team.filter')}>
          {FILTERS.map((k) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`btn-sm ${filter === k ? 'btn-primary' : 'btn-ghost'}`} data-testid="m18-cc-filter">
              {t(`m18.cc.team.f.${k}`)}
            </button>
          ))}
        </div>
        {shown.length === 0 ? <EmptyState title={t('m18.cc.team.noneFilter')} /> : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m18-cc-team">
            {shown.map((x) => {
              const openRow = x.open ? convs.find((c) => c.id === x.open!.id) : null;
              const asp = asPrep(openRow?.prep).aspirations?.[0];
              return (
                <li key={x.person_id} className="card flex items-start gap-3 p-3" data-testid="m18-cc-person" data-person={x.person_id}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-eyebrow" aria-hidden>
                    {x.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{pick({ n_en: x.name, n_ar: x.name_ar }, 'n')}</div>
                    <div className="text-[12.5px] text-ink-2">{x.role_id ? pick(cat.roleById.get(x.role_id), 'title') : '—'}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <CadencePill c={x.cadence} />
                      {openRow ? <ConvStatusPill r={openRow} /> : x.last ? <ConvStatusPill r={{ status: x.last.status, prep_submitted_at: null, employee_agrees: x.last.agrees }} /> : <StatusPill tone="neutral">{t('m18.cc.team.never')}</StatusPill>}
                      {asp && <StatusPill tone="accent">{t(`m18.cc.asp.${asp}`)}</StatusPill>}
                    </div>
                    <div className="mt-1 text-[12px] text-ink-3">{x.last ? t('m18.cc.team.lastHeld', { date: f.date(x.last.held_on) }) : t('m18.cc.team.noRecord')}</div>
                  </div>
                  <button className={waiting(x) ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => open(x.person_id)} data-testid="m18-cc-open">
                    {waiting(x) ? t('m18.cc.team.record') : awaiting(x) ? t('m18.cc.team.view') : t('m18.cc.team.start')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Modal open={!!selRow} onClose={() => open(null)} size="lg" title={selRow ? pick({ n_en: selRow.name, n_ar: selRow.name_ar }, 'n') : ''}>
        {selRow && <Workspace tr={selRow} convs={convs.filter((c) => c.person_id === selRow.person_id)} cat={cat} />}
      </Modal>
      <ConfirmDialog open={remind} onClose={() => setRemind(false)} title={t('m18.cc.team.remindTitle')} consequence={t('m18.cc.team.remindBody', { n: f.num(counts.overdue) })} confirmLabel={t('m18.cc.team.remind')}
        onConfirm={async () => { const r = await run(() => repo.rpc.conversationReminders(), t('m18.cc.team.remindDone')); if (r.ok) setRemind(false); }} />
    </>
  );
}

// ───────────── per-person workspace
function Workspace({ tr, convs, cat }: { tr: TeamRow; convs: Row[]; cat: CcCatalogue }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const pick = usePick();
  const open = tr.open ? convs.find((c) => c.id === tr.open!.id) ?? null : null;
  const stored = asAgenda(open?.agenda);
  const preview = useQuery(['career_targets', 'roadmaps', 'person_skills', 'qual_records'], async () => {
    if (stored) return null;
    const r = await repo.rpc.conversationAgenda(tr.person_id);
    if (!r.ok) throw new Error(r.message);
    return r.data as Agenda;
  }, [tr.person_id, !!stored]);
  const history = convs.filter((c) => c.status === 'acknowledged').sort((a, b) => String(b.held_on).localeCompare(String(a.held_on)));
  const name = pick({ n_en: tr.name, n_ar: tr.name_ar }, 'n');
  return (
    <div data-testid="m18-cc-workspace">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CadencePill c={tr.cadence} />
        {open && <ConvStatusPill r={open} />}
        {tr.role_id && <StatusPill tone="neutral">{pick(cat.roleById.get(tr.role_id), 'title')}</StatusPill>}
      </div>
      <Tabs tabs={[
        {
          id: 'now', label: t('m18.cc.ws.now'), content: (
            <div className="space-y-4">
              {open?.status === 'held' && <Callout tone="sim" title={t('m18.cc.ws.heldTitle', { date: f.date(String(open.held_on)) })}>{t('m18.cc.ws.heldBody', { name })}</Callout>}
              <Section title={t('m18.cc.ws.prep')}>
                {open?.prep_submitted_at ? <Card><PrepSummary p={asPrep(open.prep)} /></Card> : <Callout tone="info">{t('m18.cc.ws.noPrep', { name })}</Callout>}
              </Section>
              <Section title={t('m18.cc.agenda.title')}>
                {stored ? <AgendaView a={stored} cat={cat} /> : <Async state={preview}>{(a) => (a ? <AgendaView a={a} cat={cat} /> : null)}</Async>}
              </Section>
              {stored ? <Record tr={tr} open={open} agenda={stored} cat={cat} /> : <Async state={preview}>{(a) => <Record tr={tr} open={open} agenda={a} cat={cat} />}</Async>}
            </div>
          ),
        },
        {
          id: 'history', label: t('m18.cc.tab.history'), badge: history.length ? f.num(history.length) : undefined, content: history.length === 0 ? <EmptyState title={t('m18.cc.history.none')} /> : (
            <ul className="space-y-3">
              {history.map((h) => (
                <li key={h.id}>
                  <Card title={t('m18.cc.held.title', { date: f.date(String(h.held_on)) })} actions={<ConvStatusPill r={h} />}>
                    <PrepSummary p={asPrep(h.prep)} />
                    <div className="mt-3"><ActionList actions={asActions(h.actions)} cat={cat} /></div>
                    {h.employee_comment && <div className="mt-3"><Callout tone="sim" title={t('m18.cc.history.employeeComment')}>{h.employee_comment}</Callout></div>}
                  </Card>
                </li>
              ))}
            </ul>
          ),
        },
      ]} />
    </div>
  );
}

interface Draft { id: string; kind: string; title: string; title_ar: string; due_on: string; course_id: string; owner: string }
const toDraft = (a: Action): Draft => ({ id: a.id, kind: a.kind, title: a.title.en, title_ar: a.title.ar, due_on: a.due_on ?? '', course_id: a.course_id ?? '', owner: a.owner });

function Record({ tr, open, agenda, cat }: { tr: TeamRow; open: Row | null; agenda: Agenda | null; cat: CcCatalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useCcAction();
  const eng = useEngine('recommend');
  const lang = useLang();
  const today = todayIso();
  const prep = asPrep(open?.prep);
  const firstTarget = agenda?.targets.find((x) => x.band !== 'path_only')?.role_id ?? '';
  const [heldOn, setHeldOn] = useState(open?.held_on ? String(open.held_on).slice(0, 10) : today);
  const [notes, setNotes] = useState(open?.notes ?? '');
  const [focus, setFocus] = useState(open?.focus_role_id ?? firstTarget);
  const [hours, setHours] = useState(open?.coach_hours != null ? String(open.coach_hours) : '');
  const [acts, setActs] = useState<Draft[]>(asActions(open?.actions).map(toDraft));
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setActs(asActions(open?.actions).map(toDraft)); }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = (m: Map<string, Record<string, unknown>>, id: string, en = 'title_en', ar = 'title_ar') => { const r = m.get(id); return { en: String(r?.[en] ?? id), ar: String(r?.[ar] ?? id) }; };
  const suggestions = useMemo(() => suggestActions(agenda, prep, cat.courses as never, (id) => title(cat.roleById as never, id), (id) => title(cat.compById as never, id, 'name_en', 'name_ar'), (id) => title(cat.stdById as never, id), new Set(), today),
    [agenda, prep, cat, today]); // eslint-disable-line react-hooks/exhaustive-deps
  if (open?.status === 'acknowledged') return null;
  const nextId = () => { let i = 1; while (acts.some((a) => a.id === `a${i}`)) i++; return `a${i}`; };
  const add = (a: Omit<Action, 'id'>) => setActs((x) => (x.length >= MAX_ACTIONS ? x : [...x, toDraft({ ...a, id: nextId() })]));
  const upd = (i: number, k: keyof Draft, v: string) => setActs((x) => x.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const roles = cat.roles.filter((r) => !r.security_sensitive);
  const roleOpts = [...(agenda?.targets ?? []).filter((x) => x.band !== 'path_only').map((x) => x.role_id), ...(tr.role_id ? [tr.role_id] : []), ...roles.map((r) => r.id)]
    .filter((id, i, a) => a.indexOf(id) === i && roles.some((r) => r.id === id)).map((id) => ({ value: id, label: pick(cat.roleById.get(id), 'title') }));
  const valid = acts.every((a) => (a.title.trim() || a.title_ar.trim()).length > 0) && !!heldOn;
  const submit = () => run(() => repo.rpc.recordConversation({
    conversation_id: open && open.manager_read_id ? open.id : null, person_id: tr.person_id, held_on: heldOn, notes, focus_role_id: focus || null, coach_hours: hours === '' ? null : Number(hours),
    actions: acts.map((a) => ({ id: a.id, kind: a.kind, title: { en: a.title.trim(), ar: a.title_ar.trim() }, due_on: a.due_on || null, course_id: a.course_id || null, owner: a.owner })),
  }), acts.length ? t('m18.cc.rec.doneActions') : t('m18.cc.rec.done'));
  const name = pick({ n_en: tr.name, n_ar: tr.name_ar }, 'n');
  return (
    <>
      <Section title={t('m18.cc.sugg.title')} description={t('m18.cc.sugg.desc')} actions={<EngineBadge engine={eng} />}>
        {suggestions.length === 0 ? <p className="text-[13px] text-ink-3">{t('m18.cc.sugg.none')}</p> : (
          <ul className="space-y-1.5" data-testid="m18-cc-suggestions">
            {suggestions.map((s) => {
              const added = acts.some((a) => a.title === s.item.title.en);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-raised p-2 text-[13px]" data-testid="m18-cc-suggestion">
                  <StatusPill tone="neutral">{t(`m18.cc.kind.${s.item.kind}`)}</StatusPill>
                  <span className="min-w-0 flex-1 font-medium">{pick({ t_en: s.item.title.en, t_ar: s.item.title.ar }, 't')}</span>
                  <WhyThis reasons={s.reasons} testId="m18-cc-sugg-why" />
                  <button type="button" className="btn-ghost btn-sm" disabled={added || acts.length >= MAX_ACTIONS} onClick={() => add(s.item)} data-testid="m18-cc-sugg-add">
                    <Icon name={added ? 'check' : 'plus'} size={13} />{added ? t('m18.cc.sugg.added') : t('m18.cc.sugg.add')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title={open?.status === 'held' ? t('m18.cc.rec.amend') : t('m18.cc.rec.title')} description={t('m18.cc.rec.desc', { name })}>
        <Card>
          <div className="space-y-3" data-testid="m18-cc-record-form">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField type="date" label={t('m18.cc.rec.heldOn')} name="held_on" value={heldOn} onChange={setHeldOn} required />
              <SelectField label={t('m18.cc.rec.focus')} name="focus" value={focus} onChange={setFocus} options={roleOpts} placeholder={t('m18.cc.rec.focusNone')} />
              <TextField type="number" label={t('m18.cc.rec.hours')} name="hours" value={hours} onChange={(v) => setHours(v === '' ? '' : String(Math.max(0, Math.min(40, Number(v)))))} hint={t('m18.cc.rec.hoursHint')} />
            </div>
            <TextArea label={t('m18.cc.rec.notes')} name="notes" rows={4} value={notes} onChange={(v) => setNotes(v.slice(0, 4000))} hint={t('m18.cc.rec.notesHint')} />
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold">{t('m18.cc.rec.actions', { n: f.num(acts.length), max: f.num(MAX_ACTIONS) })}</legend>
              <ul className="space-y-2" data-testid="m18-cc-action-editor">
                {acts.map((a, i) => (
                  <li key={a.id} className="grid grid-cols-1 gap-2 rounded-card border border-line p-2 sm:grid-cols-12">
                    <div className="sm:col-span-3"><SelectField label={t('m18.cc.rec.kind')} name={`kind-${a.id}`} value={a.kind} onChange={(v) => upd(i, 'kind', v)} options={ACTION_KINDS.map((k) => ({ value: k, label: t(`m18.cc.kind.${k}`) }))} /></div>
                    <div className="sm:col-span-5"><TextField label={t('m18.cc.rec.actionTitle')} name={`title-${a.id}`} value={lang === 'ar' ? a.title_ar || a.title : a.title || a.title_ar} onChange={(v) => setActs((x) => x.map((y, j) => (j === i ? { ...y, title: v.slice(0, 200), title_ar: v.slice(0, 200) } : y)))} /></div>
                    <div className="sm:col-span-2"><TextField type="date" label={t('m18.cc.rec.due')} name={`due-${a.id}`} value={a.due_on} onChange={(v) => upd(i, 'due_on', v)} /></div>
                    <div className="sm:col-span-2"><SelectField label={t('m18.cc.rec.owner')} name={`owner-${a.id}`} value={a.owner} onChange={(v) => upd(i, 'owner', v || 'employee')} options={ACTION_OWNERS.map((k) => ({ value: k, label: t(`m18.cc.owner.${k}`) }))} /></div>
                    <div className="flex items-center justify-between gap-2 sm:col-span-12">
                      <span className="text-[12px] text-ink-3">{a.course_id ? pick(cat.courseById.get(a.course_id), 'title') : ''}</span>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setActs((x) => x.filter((_, j) => j !== i))}>{t('m18.cc.rec.remove')}</button>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-ghost btn-sm mt-2" disabled={acts.length >= MAX_ACTIONS} onClick={() => add({ kind: 'ojt', title: { en: '', ar: '' }, due_on: null, course_id: null, owner: 'employee' })} data-testid="m18-cc-add-action">
                <Icon name="plus" size={13} />{t('m18.cc.rec.addAction')}
              </button>
            </fieldset>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button type="button" className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m18-cc-record"><Icon name="check" size={14} />{open?.status === 'held' ? t('m18.cc.rec.saveAmend') : t('m18.cc.rec.save')}</button>
              <span className="text-[12px] text-ink-3">{t('m18.cc.rec.onlyEmployee', { name })}</span>
            </div>
          </div>
        </Card>
      </Section>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m18.cc.rec.confirmTitle')} consequence={t('m18.cc.rec.confirmBody', { name, n: f.num(acts.length) })} actingAs={t('m18.cc.rec.actingAs')} confirmLabel={t('m18.cc.rec.save')}
        onConfirm={async () => { const r = await submit(); if (r.ok) setConfirm(false); }} />
    </>
  );
}

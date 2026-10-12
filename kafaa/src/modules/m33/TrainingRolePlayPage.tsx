// FS59 /training/role-play (recognition A: instructors, the training manager, the HR authority). Reviews tab (?tab=reviews, default): the
// sessions people sent to me by name, with the per-turn rubric ticks, the rubric and the context they gave (never their words). I validate
// (rating evidence, basis validated, level 1-2, on the scenario's skills, recomputed through the shared skills engine; one ledger row) or
// decline with a reason (rpc.attachRoleplayEvidence; maker-checker: never my own session, only sessions sent to me). Library tab: every
// scenario (drafts too for training staff) with its EN/AR rubric; the training manager (secure_items A) adds, edits, publishes or retires
// them through rpc.saveRoleplayScenario, which re-checks every rule (3-5 turns, 3-8 criteria, every criterion used, both languages, no plant
// security wording) and audits the save.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Async, Callout, EmptyState, BenchmarkChips, ConfirmDialog, DataTable, Drawer, Tabs, StatusPill, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { evidenceSkills, rpScenarioProblem, type RpScenarioInput } from './roleplay';
import type { RpQueue, RpQueueItem } from './backend/rpc';
import { KindTag, ReviewTag, RubricList, ScenarioEditor, Ticks } from './fs65ui';
import { ScenarioDetail } from './RolePlayLibraryPage';
import { useM33Ref, type M33Ref, type Row } from './ui';

function useTraining() {
  const repo = useRepo();
  return useQuery(['roleplay_sessions', 'roleplay_scenarios', 'skill_evidence'], async () => {
    const [queue, scenarios] = await Promise.all([
      repo.rpc.roleplayReviewQueue().catch(() => null),
      repo.list('roleplay_scenarios' as never, { order: [['sort', 'asc']] } as never).catch(() => [] as Row[]) as Promise<Row[]>,
    ]);
    return { queue, scenarios };
  }, []);
}

export default function TrainingRolePlayPage() {
  const t = useT();
  const ref = useM33Ref();
  const q = useTraining();
  return (
    <Page title={t('m33.routes.training-role-play.title')} intro={t('m33.rp.tr.intro')} wide eyebrow={<BenchmarkChips feature="FS59" />}>
      <Async state={ref}>{(d) => <Async state={q}>{(x) => <Training d={d} queue={x.queue} scenarios={x.scenarios} reload={q.reload} />}</Async>}</Async>
    </Page>
  );
}

function Training({ d, queue, scenarios, reload }: { d: M33Ref; queue: RpQueue | null; scenarios: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'library' ? 'library' : 'reviews';
  const items = queue?.items ?? [];
  return (
    <Tabs value={tab} onChange={(id) => { const p = new URLSearchParams(params); p.set('tab', id); setParams(p, { replace: true }); }} tabs={[
      { id: 'reviews', label: t('m33.rp.tr.tabReviews'), badge: items.length ? <span className="num">{f.num(items.length)}</span> : undefined, content: <Reviews d={d} queue={queue} reload={reload} /> },
      { id: 'library', label: t('m33.rp.tr.tabLibrary'), badge: <span className="num">{f.num(scenarios.length)}</span>, content: <LibraryAdmin d={d} scenarios={scenarios} reload={reload} /> },
    ]} />
  );
}

function Reviews({ d, queue, reload }: { d: M33Ref; queue: RpQueue | null; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const [validate, setValidate] = useState<RpQueueItem | null>(null);
  const [decline, setDecline] = useState<RpQueueItem | null>(null);
  const skillName = (id: string) => { const s = d.skills.find((x: Row) => x.id === id); return s ? pick(s, 'name') : id; };
  const person = (x: RpQueueItem) => (lang === 'ar' ? x.person_name_ar || x.person_name : x.person_name);
  if (!queue) return <div className="pt-3"><Callout tone="info">{t('m33.rp.tr.noQueue')}</Callout></div>;
  const decide = async (x: RpQueueItem, decision: 'validate' | 'decline', note: string) => {
    const r = await act(() => repo.rpc.attachRoleplayEvidence({ session_id: x.session_id, decision, note }));
    if (r.ok) reload?.();
  };
  const cols: Column<RpQueueItem>[] = [
    { key: 'when', header: t('m33.rp.tr.decidedOn'), value: (x) => String(x.reviewed_at ?? ''), render: (x) => (x.reviewed_at ? f.date(String(x.reviewed_at).slice(0, 10)) : '—'), sortable: true },
    { key: 'person', header: t('m33.rp.tr.person'), value: (x) => person(x) },
    { key: 'scenario', header: t('m33.aps.hist.scenario'), value: (x) => pick(x as unknown as Row, 'title') },
    { key: 'status', header: t('m33.rp.col.review'), value: (x) => x.review_status, render: (x) => <ReviewTag status={x.review_status} /> },
  ];
  return (
    <div className="space-y-4 pt-3">
      <Callout tone="info" title={t('m33.rp.tr.ruleTitle')}>{t('m33.rp.tr.ruleBody')}</Callout>
      {queue.items.length ? (
        <div className="space-y-4" data-testid="m33-rp-queue">
          {queue.items.map((x) => (
            <Card key={x.session_id} as="article">
              <div className="space-y-3" data-testid="m33-rp-queue-item" data-id={x.session_id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><KindTag kind={x.kind} /><span className="text-[12px] text-ink-3">{t('m33.rp.tr.requested', { date: f.date(String(x.requested_at ?? '').slice(0, 10) || '2026-01-01') })}</span></div>
                    <div className="mt-1 font-semibold"><span className="num me-1.5 text-[11.5px] text-ink-3">{x.code}</span>{pick(x as unknown as Row, 'title')}</div>
                    <div className="text-[13px] text-ink-2">{person(x)}</div>
                  </div>
                  <div className="text-end"><div className="num text-[22px] font-semibold">{f.num(x.pct)}%</div><div className="text-[12px] text-ink-3">{t('m33.rp.tr.ofMark', { passed: f.num(x.passed), total: f.num(x.total), mark: f.num(x.pass_pct) })}</div></div>
                </div>
                {x.review_context && <blockquote className="rounded-card border-s-4 border-accent bg-sunken p-2.5 text-[13px]" data-testid="m33-rp-queue-context"><span className="caps me-1 text-[10.5px]">{t('m33.rp.tr.context')}</span>{x.review_context}</blockquote>}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="space-y-2">{x.turns.map((tr, i) => (
                    <div key={tr.turn_id} className="rounded-card border border-line p-2.5">
                      <div className="caps mb-1 text-[10.5px]">{t('m33.rp.turnN', { n: f.num(i + 1) })} · {t('m33.rp.words', { n: f.num(tr.words) })}</div>
                      <Ticks results={tr.criteria} rubric={x.rubric} testId={`m33-rp-qticks-${i}`} />
                    </div>
                  ))}</div>
                  <div><h3 className="caps mb-1">{t('m33.rp.rubricTitle')}</h3><RubricList rubric={x.rubric} compact testId="m33-rp-queue-rubric" /></div>
                </div>
                <p className="text-[12px] text-ink-3">{t('m33.rp.tr.skills', { list: x.skills.map(skillName).join(lang === 'ar' ? '، ' : ', ') || '—', level: f.num(x.level) })}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn-outline btn-sm" onClick={() => setDecline(x)} data-testid="m33-rp-decline">{t('m33.rp.tr.decline')}</button>
                  <button type="button" className="btn-primary btn-sm" onClick={() => setValidate(x)} data-testid="m33-rp-validate">{t('m33.rp.tr.validate')}</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : <EmptyState title={t('m33.rp.tr.empty')}>{t('m33.rp.tr.emptyBody')}</EmptyState>}
      {queue.decided.length > 0 && (
        <Card title={t('m33.rp.tr.decided')}>
          <div data-testid="m33-rp-decided"><DataTable rows={queue.decided} columns={cols} rowKey={(x) => x.session_id} searchable={false} pageSize={8} caption={t('m33.rp.tr.decided')} dense /></div>
        </Card>
      )}
      <ConfirmDialog open={!!validate} onClose={() => setValidate(null)} title={t('m33.rp.tr.validateTitle')} actingAs={t('m33.rp.tr.actingAs')}
        consequence={validate ? t('m33.rp.tr.validateBody', { person: person(validate), level: f.num(validate.level), list: validate.skills.map(skillName).join(lang === 'ar' ? '، ' : ', ') }) : ''}
        confirmLabel={t('m33.rp.tr.validate')} onConfirm={async () => { if (validate) await decide(validate, 'validate', ''); setValidate(null); }} />
      <ConfirmDialog open={!!decline} onClose={() => setDecline(null)} title={t('m33.rp.tr.declineTitle')} actingAs={t('m33.rp.tr.actingAs')} consequence={t('m33.rp.tr.declineBody')}
        requireReason reasonLabel={t('m33.rp.tr.reason')} confirmLabel={t('m33.rp.tr.decline')} danger onConfirm={async (reason) => { if (decline) await decide(decline, 'decline', reason.trim()); setDecline(null); }} />
    </div>
  );
}

const EDIT_KEYS = ['code', 'kind', 'title_en', 'title_ar', 'summary_en', 'summary_ar', 'setting_en', 'setting_ar', 'counterpart_en', 'counterpart_ar', 'role_en', 'role_ar',
  'core_skill_ids', 'skill_ids', 'level', 'pass_pct', 'est_minutes', 'turns', 'rubric'] as const;

function LibraryAdmin({ d, scenarios, reload }: { d: M33Ref; scenarios: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const canWrite = s.can('secure_items', ['A']);
  const [open, setOpen] = useState<Row | null>(null);
  const [edit, setEdit] = useState<{ id: string | null; status: string; body: Record<string, unknown> } | null>(null);
  const [status, setStatus] = useState<{ row: Row; to: 'published' | 'retired' } | null>(null);
  const ctx = useMemo(() => ({ coreSkillIds: d.core.map((c: Row) => c.id), evidenceSkillIds: evidenceSkills(d.skills.map((x: Row) => x.id), new Map(d.skills.map((x: Row) => [x.id, x]))) }), [d]);
  const bodyOf = (r: Row) => Object.fromEntries(EDIT_KEYS.map((k) => [k, r[k]]));
  const save = async (id: string | null, st: string, body: Record<string, unknown>) => {
    const r = await act(() => repo.rpc.saveRoleplayScenario({ ...(body as unknown as RpScenarioInput), id, status: st }));
    if (r.ok) reload?.();
    return r.ok;
  };
  const cols: Column<Row>[] = [
    { key: 'code', header: t('m33.rp.col.code'), value: (r) => r.code, render: (r) => <span className="num text-[12px]">{r.code}</span>, sortable: true },
    { key: 'kind', header: t('m33.rp.col.kind'), value: (r) => r.kind, render: (r) => <KindTag kind={r.kind} />, sortable: true },
    { key: 'title', header: t('m33.rp.col.title'), value: (r) => pick(r, 'title') },
    { key: 'rubric', header: t('m33.rp.col.rubric'), align: 'end', value: (r) => (r.rubric ?? []).length, render: (r) => <span className="num">{f.num((r.rubric ?? []).length)}</span> },
    { key: 'status', header: t('m33.bank.col.status'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'published' ? 'ok' : r.status === 'draft' ? 'info' : 'neutral'}>{t(`m33.rp.status.${r.status}`)}</StatusPill> },
    { key: 'v', header: t('m33.bank.col.version'), align: 'end', value: (r) => r.version, render: (r) => <span className="num">{f.num(r.version)}</span> },
  ];
  const template = scenarios.find((r) => r.status === 'published') ?? scenarios[0];
  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-2">{canWrite ? t('m33.rp.tr.libWrite') : t('m33.rp.tr.libRead')}</p>
        {canWrite && template && <button type="button" className="btn-primary btn-sm" onClick={() => setEdit({ id: null, status: 'draft', body: { ...bodyOf(template), code: 'RP-XX-01' } })} data-testid="m33-rp-add">{t('m33.rp.tr.add')}</button>}
      </div>
      {scenarios.length ? <div data-testid="m33-rp-admin-list"><DataTable rows={scenarios} columns={cols} rowKey={(r) => r.id} onRowClick={(r) => setOpen(r)} searchable={false} pageSize={12} caption={t('m33.rp.tr.tabLibrary')} /></div>
        : <EmptyState title={t('m33.rp.lib.none')} />}
      <Callout tone="sim" title={t('m33.bank.security.title')}>{t('m33.rp.tr.security')}</Callout>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${open.code} · ${pick(open, 'title')}` : ''}
        footer={open && canWrite ? <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => { setEdit({ id: open.id, status: open.status, body: bodyOf(open) }); setOpen(null); }} data-testid="m33-rp-edit">{t('m33.bank.edit')}</button>
          {open.status !== 'published' && <button type="button" className="btn-outline btn-sm" onClick={() => { setStatus({ row: open, to: 'published' }); setOpen(null); }} data-testid="m33-rp-publish">{t('m33.rp.tr.publish')}</button>}
          {open.status === 'published' && <button type="button" className="btn-outline btn-sm" onClick={() => { setStatus({ row: open, to: 'retired' }); setOpen(null); }} data-testid="m33-rp-retire">{t('m33.bank.retire')}</button>}
        </div> : undefined}>
        {open && <ScenarioDetail r={open} />}
      </Drawer>
      <ScenarioEditor open={!!edit} onClose={() => setEdit(null)} testId="m33-rp-editor" initial={edit?.body ?? null}
        title={edit?.id ? t('m33.rp.tr.editTitle', { code: String(edit.body.code) }) : t('m33.rp.tr.addTitle')}
        problemOf={(x) => { const p = rpScenarioProblem(x as Partial<RpScenarioInput>, ctx); return p ? t(`m33.rp.problem.${p}`) : null; }}
        onSave={(x) => save(edit?.id ?? null, edit?.status ?? 'draft', x)} />
      <ConfirmDialog open={!!status} onClose={() => setStatus(null)} title={status ? t(`m33.rp.tr.${status.to}Title`, { code: status.row.code }) : ''} consequence={status ? t(`m33.rp.tr.${status.to}Body`) : ''}
        danger={status?.to === 'retired'} confirmLabel={status?.to === 'retired' ? t('m33.bank.retire') : t('m33.rp.tr.publish')}
        onConfirm={async () => { if (status) await save(status.row.id, status.to, bodyOf(status.row)); setStatus(null); }} />
    </div>
  );
}


// FS77 /workforce/intake-baselines: intake-year baselines and induction plans (FS wave H · E5). HR (workforce_strategy W) edits and
// publishes baselines and (re)builds plans; training staff, admins and auditors read. Baselines are versioned (draft, published,
// superseded); mandatory nuclear modules are locked ("always taught"); the editor shows the first problem before saving and the induction
// the baseline would give. Plans read the published baseline for the joiner's intake year; a plan whose intake now reads a different
// baseline is marked stale and can be rebuilt. Every write goes through an RPC behind a ConfirmDialog.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import {
  Async, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, EmptyState, Grid, Icon, Page, SelectField, StatTile, StatusPill, Tabs, TextField,
} from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import {
  BASELINE_SCOPES, ENTRY_BASES, ENTRY_STATUSES, PLAN_PROGRAMMES, YEAR_MAX, YEAR_MIN, baselineFor, baselineProblem, entriesOf, inductionPlan, listedModules, planStale,
  type BaselineEntry, type Joiner, type PlanItem,
} from './starter';
import { PlanTable, useStarterRefs, type BaselineFull, type ModuleRow } from './starterUi';

interface PlanRow {
  id: string; person_id: string; person_name: string; programme: string; intake_year: number; baseline_id: string | null; baseline_version: number | null;
  items: PlanItem[]; hours_total: number; hours_planned: number; hours_saved: number; revision: number; built_at: string;
}
type Draft = { year: string; scope: string; entries: Record<string, { status: string; basis: string; source_url: string; note_en: string; note_ar: string }>; note_en: string; note_ar: string };
const STATUS_TONE: Record<string, 'ok' | 'info' | 'neutral'> = { published: 'ok', draft: 'info', superseded: 'neutral' };

export default function WorkforceIntakeBaselinesPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const refs = useStarterRefs();
  const canW = s.can('workforce_strategy', ['W']);
  const plans = useQuery('induction_plans', async () => ({ rows: (await repo.list('induction_plans', { order: [['intake_year', 'desc']] })) as unknown as PlanRow[] }));
  const rows = useMemo(() => (plans.data?.rows ?? []).map((p) => ({ ...p, intake_year: Number(p.intake_year), hours_planned: Number(p.hours_planned), hours_saved: Number(p.hours_saved), hours_total: Number(p.hours_total) })), [plans.data]);
  const stale = rows.filter((p) => refs.baselines.length > 0 && planStale(p, refs.baselines));
  const [tab, setTab] = useState('baselines');
  return (
    <Page title={t('m06.routes.workforce-intake-baselines.title')} eyebrow={t('m06.ibw.eyebrow')} intro={t('m06.ibw.intro')} wide>
      <BenchmarkChips feature="FS77" />
      <Grid cols={4}>
        <StatTile label={t('m06.ibw.stat.published')} value={f.num(refs.baselines.filter((b) => b.status === 'published').length)} />
        <StatTile label={t('m06.ibw.stat.drafts')} value={f.num(refs.baselines.filter((b) => b.status === 'draft').length)} tone="info" />
        <StatTile label={t('m06.ibw.stat.plans')} value={f.num(rows.length)} />
        <StatTile label={t('m06.ibw.stat.stale')} value={<span data-testid="m06-ibw-stale-count">{f.num(stale.length)}</span>} tone={stale.length ? 'sim' : 'ok'} />
      </Grid>
      {!canW && <Callout tone="info">{t('m06.ibw.readOnly')}</Callout>}
      <Async state={refs.modulesState}>
        {() => (
          <Tabs value={tab} onChange={setTab} tabs={[
            { id: 'baselines', label: t('m06.ibw.tab.baselines'), content: <BaselinesTab modules={refs.modules} baselines={refs.baselines} plans={rows} canW={canW} /> },
            { id: 'plans', label: t('m06.ibw.tab.plans'), badge: stale.length ? f.num(stale.length) : undefined, content: <PlansTab plans={rows} modules={refs.modules} baselines={refs.baselines} canW={canW} state={plans} /> },
            { id: 'joiners', label: t('m06.ibw.tab.joiners'), content: <JoinersTab canW={canW} /> },
          ]} />
        )}
      </Async>
    </Page>
  );
}

// ───────────── baselines
function BaselinesTab({ modules, baselines, plans, canW }: { modules: ModuleRow[]; baselines: BaselineFull[]; plans: PlanRow[]; canW: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [draft, setDraft] = useState<Draft | null>(null);
  const groups = useMemo(() => {
    const g = new Map<string, BaselineFull[]>();
    for (const b of baselines) {
      const k = `${b.intake_year}|${b.programme}`;
      g.set(k, [...(g.get(k) ?? []), b]);
    }
    return [...g.entries()].map(([k, list]) => ({ k, year: Number(k.split('|')[0]), scope: k.split('|')[1], list: list.sort((a, b) => b.version - a.version) }))
      .sort((a, b) => b.year - a.year || (a.scope === 'all' ? -1 : b.scope === 'all' ? 1 : a.scope < b.scope ? -1 : 1));
  }, [baselines]);
  const open = (year: number, scope: string, from?: BaselineFull) => {
    const ents = Object.fromEntries(entriesOf(from ?? null).map((e) => [e.module_id, { status: e.status, basis: e.basis, source_url: e.source_url ?? '', note_en: e.note_en ?? '', note_ar: e.note_ar ?? '' }]));
    setDraft({ year: String(year), scope, entries: ents, note_en: from?.note_en ?? '', note_ar: from?.note_ar ?? '' });
  };
  const nextYear = Math.max(...baselines.map((b) => b.intake_year), 2026) + 1;
  return (
    <div className="space-y-4 pt-4">
      {canW && !draft && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => open(nextYear, 'all')} data-testid="m06-ibw-new">
            <Icon name="plus" size={14} />
            {t('m06.ibw.new', { year: f.num(nextYear, { useGrouping: false }) })}
          </button>
        </div>
      )}
      {draft && <BaselineEditor draft={draft} setDraft={setDraft} modules={modules} baselines={baselines} plans={plans} onClose={() => setDraft(null)} />}
      <ul className="space-y-3" data-testid="m06-ibw-baselines">
        {groups.map((g) => {
          const openDraft = g.list.find((b) => b.status === 'draft');
          const live = g.list.find((b) => b.status === 'published');
          return (
            <li key={g.k} className="card p-4" data-testid={`m06-ibw-group-${g.year}-${g.scope}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-[15px] font-semibold">{f.num(g.year, { useGrouping: false })}</span>
                  <span className="chip border-line bg-panel text-ink-2">{t(`m06.ind.programme.${g.scope}`)}</span>
                </div>
                {canW && (
                  <button type="button" className="btn-outline btn-sm" onClick={() => open(g.year, g.scope, openDraft ?? live ?? g.list[0])} data-testid={`m06-ibw-edit-${g.year}-${g.scope}`}>
                    {openDraft ? t('m06.ibw.editDraft') : t('m06.ibw.newVersion')}
                  </button>
                )}
              </div>
              <ul className="mt-2 divide-y divide-line">
                {g.list.map((b) => {
                  const ents = entriesOf(b);
                  return (
                    <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]" data-testid="m06-ibw-baseline" data-id={b.id} data-status={b.status}>
                      <StatusPill tone={STATUS_TONE[b.status]}>{t(`m06.ibw.status.${b.status}`)}</StatusPill>
                      <span className="num">{t('m06.ibw.version', { n: f.num(b.version) })}</span>
                      <span className="text-ink-2">{t('m06.ibw.counts', { held: f.num(ents.filter((e) => e.status === 'held').length), partial: f.num(ents.filter((e) => e.status === 'partial').length) })}</span>
                      <span className="text-[12px] text-ink-3">{b.published_at ? t('m06.ibw.publishedOn', { date: f.date(b.published_at) }) : t('m06.ibw.savedOn', { date: f.date(b.set_at ?? null) })}</span>
                      {pick(b as never, 'note') && <span className="basis-full text-[12.5px] text-ink-2">{pick(b as never, 'note')}</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BaselineEditor({ draft, setDraft, modules, baselines, plans, onClose }: { draft: Draft; setDraft: (d: Draft) => void; modules: ModuleRow[]; baselines: BaselineFull[]; plans: PlanRow[]; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [confirm, setConfirm] = useState<'draft' | 'publish' | null>(null);
  const year = Number(draft.year);
  const entries = listedModules(modules)
    .map((m) => ({ m, e: draft.entries[m.id] }))
    .filter((x) => x.e && x.e.status)
    .map(({ m, e }) => ({ module_id: m.id, status: e!.status, basis: e!.basis || 'none', source_url: e!.source_url.trim() ? e!.source_url.trim() : null, note_en: e!.note_en, note_ar: e!.note_ar }));
  const input = { intake_year: Number.isFinite(year) && draft.year.trim() !== '' ? year : null, programme: draft.scope, entries, note_en: draft.note_en, note_ar: draft.note_ar };
  const problem = baselineProblem(input, modules);
  const preview = inductionPlan(modules, { id: 'preview', intake_year: year, programme: draft.scope, status: 'published', version: 0, entries: entries as BaselineEntry[] });
  const affected = plans.filter((p) => p.intake_year === year && (draft.scope === 'all' || p.programme === draft.scope));
  const live = baselineFor(baselines, year, draft.scope);
  const EMPTY = { status: '', basis: 'none', source_url: '', note_en: '', note_ar: '' };
  const setE = (id: string, k: string, v: string) => setDraft({ ...draft, entries: { ...draft.entries, [id]: { ...EMPTY, ...(draft.entries[id] ?? {}), [k]: v } } });
  const run = async (publish: boolean) => {
    const r = await act(() => repo.rpc.saveIntakeBaseline({ ...(input as unknown as Parameters<typeof repo.rpc.saveIntakeBaseline>[0]), publish }), { success: publish ? t('m06.ibw.publishedToast') : t('m06.ibw.savedToast') });
    if (r.ok) onClose();
  };
  return (
    <Card title={t('m06.ibw.editorTitle')} eyebrow={t('m06.ibw.editorEyebrow')} actions={<button type="button" className="btn-ghost btn-sm" onClick={onClose}>{t('common.cancel')}</button>}>
      <div className="space-y-4" data-testid="m06-ibw-editor">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m06.ibw.year')} name="intake_year" type="number" value={draft.year} onChange={(v) => setDraft({ ...draft, year: v })} hint={t('m06.ibw.yearHint', { min: String(YEAR_MIN), max: String(YEAR_MAX) })} />
          <SelectField label={t('m06.ibw.scope')} name="scope" value={draft.scope} onChange={(v) => setDraft({ ...draft, scope: v })} options={BASELINE_SCOPES.map((x) => ({ value: x, label: t(`m06.ind.programme.${x}`) }))} />
        </div>
        <ul className="divide-y divide-line rounded-card border border-line" data-testid="m06-ibw-entries">
          {listedModules(modules).map((m0) => {
            const m = m0 as ModuleRow;
            const e = draft.entries[m.id];
            return (
              <li key={m.id} className="space-y-2 p-3" data-testid={`m06-ibw-entry-${m.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{pick(m as never, 'title')}</span>
                  <span className="num text-[12px] text-ink-3">{t('m06.ind.hoursN', { n: f.num(m.hours) })}</span>
                </div>
                {m.mandatory ? (
                  <div className="text-[12.5px] text-ink-2" data-testid={`m06-ibw-locked-${m.id}`}><Icon name="lock" size={12} /> {t('m06.ibw.locked')}</div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <SelectField label={t('m06.ibw.entryStatus')} name={`st-${m.id}`} value={e?.status ?? ''} onChange={(v) => setE(m.id, 'status', v)}
                      options={[{ value: '', label: t('m06.ibw.noEntry') }, ...ENTRY_STATUSES.map((x) => ({ value: x, label: t(`m06.ind.status.${x}`) }))]} />
                    <SelectField label={t('m06.ibw.basis')} name={`bs-${m.id}`} value={e?.basis ?? 'none'} onChange={(v) => setE(m.id, 'basis', v)}
                      options={ENTRY_BASES.map((x) => ({ value: x, label: t(`m06.ind.basis.${x}`) }))} />
                    <TextField label={t('m06.ibw.source')} name={`src-${m.id}`} value={e?.source_url ?? ''} onChange={(v) => setE(m.id, 'source_url', v)} placeholder="https://" />
                    {e?.status && (
                      <>
                        <TextField label={t('m06.ibw.noteEn')} name={`ne-${m.id}`} value={e.note_en} onChange={(v) => setE(m.id, 'note_en', v)} />
                        <TextField label={t('m06.ibw.noteAr')} name={`na-${m.id}`} value={e.note_ar} onChange={(v) => setE(m.id, 'note_ar', v)} />
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m06.ibw.baselineNoteEn')} name="note_en" value={draft.note_en} onChange={(v) => setDraft({ ...draft, note_en: v })} />
          <TextField label={t('m06.ibw.baselineNoteAr')} name="note_ar" value={draft.note_ar} onChange={(v) => setDraft({ ...draft, note_ar: v })} />
        </div>
        <Grid cols={3}>
          <StatTile label={t('m06.ind.totals.planned')} value={<span data-testid="m06-ibw-preview-planned">{t('m06.ind.hoursN', { n: f.num(preview.hours_planned) })}</span>} sub={t('m06.ind.ofTotal', { n: f.num(preview.hours_total) })} />
          <StatTile label={t('m06.ind.totals.saved')} value={t('m06.ind.hoursN', { n: f.num(preview.hours_saved) })} tone="ok" />
          <StatTile label={t('m06.ibw.affected')} value={f.num(affected.length)} sub={live ? t('m06.ibw.replaces', { id: live.id }) : t('m06.ibw.firstForIntake')} />
        </Grid>
        {problem ? (
          <Callout tone="bad"><span data-testid="m06-ibw-problem">{t(`m06.ibw.problem.${problem}`)}</span></Callout>
        ) : (
          <Callout tone="ok">{t('m06.ibw.valid')}</Callout>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" disabled={!!problem} onClick={() => setConfirm('draft')} data-testid="m06-ibw-save">{t('m06.ibw.saveDraft')}</button>
          <button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm('publish')} data-testid="m06-ibw-publish">{t('m06.ibw.publish')}</button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'publish' ? t('m06.ibw.confirmPublishTitle') : t('m06.ibw.confirmDraftTitle')}
        consequence={confirm === 'publish' ? t('m06.ibw.confirmPublish', { n: f.num(affected.length), year: f.num(year, { useGrouping: false }) }) : t('m06.ibw.confirmDraft')}
        confirmLabel={confirm === 'publish' ? t('m06.ibw.publish') : t('m06.ibw.saveDraft')}
        onConfirm={async () => { await run(confirm === 'publish'); setConfirm(null); }}
      />
    </Card>
  );
}

// ───────────── plans
function PlansTab({ plans, modules, baselines, canW, state }: { plans: PlanRow[]; modules: ModuleRow[]; baselines: BaselineFull[]; canW: boolean; state: { loading: boolean; error: Error | null; data?: unknown; reload: () => void } }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const [rebuild, setRebuild] = useState<PlanRow[] | null>(null);
  const stale = plans.filter((p) => planStale(p, baselines));
  const shown = plans.find((p) => p.id === open);
  const doRebuild = async (list: PlanRow[]) => {
    for (const p of list) await act(() => repo.rpc.buildInductionPlan({ person_id: p.person_id, programme: p.programme, intake_year: p.intake_year }), { success: t('m06.ibw.rebuiltToast', { name: p.person_name }) });
  };
  return (
    <div className="space-y-4 pt-4">
      {canW && stale.length > 0 && (
        <Callout tone="sim" title={t('m06.ibw.staleTitle', { n: f.num(stale.length) })}>
          <div className="flex flex-wrap items-center gap-2">
            <span>{t('m06.ibw.staleBody')}</span>
            <button type="button" className="btn-primary btn-sm" onClick={() => setRebuild(stale)} data-testid="m06-ibw-rebuild-stale">{t('m06.ibw.rebuildStale')}</button>
          </div>
        </Callout>
      )}
      <Async state={state as never} empty={<EmptyState title={t('m06.ibw.noPlans')} />}>
        {() => (
          <div data-testid="m06-ibw-plans">
            <DataTable
              rows={plans}
              rowKey={(r) => r.id}
              csvName="induction-plans"
              columns={[
                { key: 'person', header: t('m06.ibw.col.joiner'), value: (r) => r.person_name, sortable: true },
                { key: 'programme', header: t('m06.ibw.col.programme'), value: (r) => t(`m06.ind.programme.${r.programme}`), sortable: true },
                { key: 'year', header: t('m06.ibw.col.year'), value: (r) => r.intake_year, render: (r) => <span className="num">{f.num(r.intake_year, { useGrouping: false })}</span>, sortable: true },
                { key: 'baseline', header: t('m06.ibw.col.baseline'), value: (r) => r.baseline_id ?? '', render: (r) => r.baseline_id ?? <span className="text-ink-3">{t('m06.ibw.none')}</span> },
                { key: 'planned', header: t('m06.ibw.col.planned'), value: (r) => r.hours_planned, render: (r) => <span className="num">{f.num(r.hours_planned)}</span>, sortable: true, align: 'end' },
                { key: 'saved', header: t('m06.ibw.col.saved'), value: (r) => r.hours_saved, render: (r) => <span className="num">{f.num(r.hours_saved)}</span>, sortable: true, align: 'end' },
                { key: 'state', header: t('m06.ibw.col.state'), value: (r) => (planStale(r, baselines) ? 'stale' : 'current'),
                  render: (r) => <span data-testid={`m06-ibw-plan-state-${r.person_id}`}>{planStale(r, baselines) ? <StatusPill tone="sim">{t('m06.ibw.stale')}</StatusPill> : <StatusPill tone="ok">{t('m06.ibw.current')}</StatusPill>}</span> },
                { key: 'actions', header: '', csv: false, render: (r) => (
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(open === r.id ? null : r.id)} data-testid={`m06-ibw-plan-open-${r.person_id}`}>{t('m06.ibw.view')}</button>
                    {canW && <button type="button" className="btn-outline btn-sm" onClick={() => setRebuild([r])} data-testid={`m06-ibw-plan-rebuild-${r.person_id}`}>{t('m06.ibw.rebuild')}</button>}
                  </div>
                ) },
              ]}
            />
          </div>
        )}
      </Async>
      {shown && (
        <Card title={shown.person_name} eyebrow={t('m06.ibw.planOf', { programme: t(`m06.ind.programme.${shown.programme}`), year: f.num(shown.intake_year, { useGrouping: false }) })}>
          <PlanTable plan={shown} modules={modules} year={shown.intake_year} testId="m06-ibw-plan-detail" />
        </Card>
      )}
      <ConfirmDialog
        open={rebuild !== null}
        onClose={() => setRebuild(null)}
        title={t('m06.ibw.confirmRebuildTitle')}
        consequence={t('m06.ibw.confirmRebuild', { n: f.num(rebuild?.length ?? 0) })}
        confirmLabel={t('m06.ibw.rebuild')}
        onConfirm={async () => { await doRebuild(rebuild ?? []); setRebuild(null); }}
      />
    </div>
  );
}

// ───────────── joiners
function JoinersTab({ canW }: { canW: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const q = useQuery(['induction_plans', 'applications'], async () => {
    const r = await repo.rpc.inductionJoiners();
    if (!r.ok) throw new Error(r.message);
    return { rows: r.data as Joiner[] };
  });
  const [pick, setPick] = useState<{ j: Joiner; programme: string; year: string } | null>(null);
  const bad = pick ? (Number.isInteger(Number(pick.year)) && Number(pick.year) >= YEAR_MIN && Number(pick.year) <= YEAR_MAX ? null : 'year') : null;
  return (
    <div className="space-y-3 pt-4">
      <p className="text-[13px] text-ink-2">{t('m06.ibw.joinersHint')}</p>
      <Async state={q}>
        {({ rows }) => (
          <ul className="grid gap-2 md:grid-cols-2" data-testid="m06-ibw-joiners">
            {rows.map((j) => (
              <li key={j.person_id} className="card flex flex-wrap items-center justify-between gap-2 p-3" data-testid="m06-ibw-joiner" data-person={j.person_id} data-source={j.source}>
                <div className="min-w-0">
                  <div className="font-semibold">{j.name}</div>
                  <div className="text-[12px] text-ink-2">
                    {t(`m06.ind.programme.${j.programme}`)} · <span className="num">{f.num(j.intake_year, { useGrouping: false })}</span> · {t(`m06.ibw.from.${j.source}`)}
                  </div>
                </div>
                {canW && (
                  <button type="button" className={j.plan_id ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => setPick({ j, programme: j.programme, year: String(j.intake_year) })} data-testid={`m06-ibw-build-${j.person_id}`}>
                    {j.plan_id ? t('m06.ibw.rebuild') : t('m06.ibw.build')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Async>
      <ConfirmDialog
        open={pick !== null}
        onClose={() => setPick(null)}
        title={t('m06.ibw.confirmBuildTitle', { name: pick?.j.name ?? '' })}
        consequence={t('m06.ibw.confirmBuild')}
        confirmLabel={t('m06.ibw.build')}
        onConfirm={async () => {
          if (!pick || bad) return;
          const r = await act(() => repo.rpc.buildInductionPlan({ person_id: pick.j.person_id, programme: pick.programme, intake_year: Number(pick.year) }), { success: t('m06.ibw.builtToast') });
          if (r.ok) setPick(null);
        }}
      >
        {pick && (
          <div className="grid gap-3 sm:grid-cols-2" data-testid="m06-ibw-build-form">
            <SelectField label={t('m06.ibw.col.programme')} name="programme" value={pick.programme} onChange={(v) => setPick({ ...pick, programme: v })} options={PLAN_PROGRAMMES.map((x) => ({ value: x, label: t(`m06.ind.programme.${x}`) }))} />
            <TextField label={t('m06.ibw.year')} name="year" type="number" value={pick.year} onChange={(v) => setPick({ ...pick, year: v })} error={bad ? 'm06.ibw.problem.year' : null} />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

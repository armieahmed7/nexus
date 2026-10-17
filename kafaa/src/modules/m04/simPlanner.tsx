/** F28 cycle planner (W4 · E3): pick scenarios per segment of a COCT/LOCT cycle; the coverage matrix flags required objectives
 *  and competencies not covered; ranked suggestions (with "Why this?") close the gaps; plan, submit and approve go through RPCs. */
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Callout, Card, ConfirmDialog, EngineBadge, Grid, Icon, KeyValue, ProgressBar, ProgressRing, SelectField, StatTile, StatusPill, WhyThis } from '../../ui';
import { useAction, useEngine, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { Ranked } from '../../domain/engines/types';
import { SEGMENT_MINUTES, cycleCoverage, gapCount, suggestScenarios, type CycleItemLite, type DebriefLite, type ScenarioLite } from './scenarios';
import { COVER_TONE, CatChip, ScnStatus, asCycle, useSimLabels, type SimLibrary } from './simUi';
import { usePeople } from './ui';

type Item = { scenario_id: string; segment: number };
const key = (i: Item) => `${i.segment}|${i.scenario_id}`;

export function CyclePlanner({ lib, debriefs }: { lib: SimLibrary; debriefs: DebriefLite[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const l = useSimLabels();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const eng = useEngine('recommend');
  const people = usePeople();
  const today = new Date().toISOString().slice(0, 10);
  const initial = lib.cycles.find((c) => c.starts_on <= today && c.ends_on >= today && c.programme === 'coct') ?? lib.cycles[0];
  const [cycleId, setCycleId] = useState(initial?.id ?? '');
  const cycle = lib.cycles.find((c) => c.id === cycleId) ?? null;
  const saved = useMemo(() => lib.items.filter((i) => i.cycle_id === cycleId && i.active).map((i) => ({ scenario_id: i.scenario_id, segment: i.segment })), [lib.items, cycleId]);
  const [draft, setDraft] = useState<Item[]>(saved);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = useMemo(() => saved.map(key).sort().join() !== draft.map(key).sort().join(), [saved, draft]);
  const canPlan = s.can('sat', ['W', 'A']) && !!cycle && cycle.status !== 'closed';
  const canApprove = s.can('sat', ['A']) && cycle?.status === 'submitted' && cycle.planned_by !== s.identity.personId && !dirty;
  const cov = useMemo(() => (cycle ? cycleCoverage(asCycle(cycle), draft.map((d) => ({ ...d, cycle_id: cycle.id })) as CycleItemLite[], lib.scMap, debriefs) : null), [cycle, draft, lib.scMap, debriefs]);
  const [ranked, setRanked] = useState<Ranked<ScenarioLite>[]>([]);
  useEffect(() => {
    if (!cycle || !cov) return;
    const comp = (id: string) => { const c = lib.compMap.get(id); return { en: c ? `${c.code} ${c.name_en}` : id, ar: c ? `${c.code} ${c.name_ar}` : id }; };
    const list = () => suggestScenarios(asCycle(cycle), cov, lib.scenarios as unknown as ScenarioLite[], lib.objMap as never, comp).slice(0, 5);
    let live = true;
    void eng.run(list, { candidates: list().map((r) => ({ id: r.id, reasons: r.reasons })), context: { surface: 'sim_scenarios', cycle: cycle.id } }).then((o) => live && setRanked(o.results as Ranked<ScenarioLite>[]));
    return () => { live = false; };
  }, [cycle, cov, lib, eng]);
  const [confirm, setConfirm] = useState<'save' | 'submit' | 'approve' | null>(null);
  if (!cycle || !cov) return null;
  const months = Math.max(1, Math.round(24 / cycle.segments));
  const segLabel = (k: number) => {
    const d = new Date(`${cycle.starts_on}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + (k - 1) * months);
    return t('m04.scn.plan.segmentOf', { n: k, date: f.date(d.toISOString().slice(0, 10)) });
  };
  const add = (it: Item) => setDraft((x) => (x.some((y) => key(y) === key(it)) ? x : [...x, it]));
  const remove = (it: Item) => setDraft((x) => x.filter((y) => key(y) !== key(it)));
  const firstFit = (sc: ScenarioLite) => cov.segments.find((g) => g.minutes + sc.duration_min <= SEGMENT_MINUTES && !draft.some((d) => d.segment === g.segment && d.scenario_id === sc.id))?.segment ?? null;
  const usable = lib.scenarios.filter((x) => x.status === 'approved' && x.programmes.includes(cycle.programme));
  const gaps = gapCount(cov);
  const doSave = async (submit: boolean) => { await run(() => repo.rpc.planCycle(cycle.id, draft, submit)); };
  return (
    <div className="space-y-4" data-testid="m04-scn-planner">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[16rem] flex-1"><SelectField label={t('m04.scn.plan.cycle')} name="cycle" value={cycleId} onChange={setCycleId} options={lib.cycles.map((c) => ({ value: c.id, label: `${pick(c, 'label')} · ${l.status(c.status)}` }))} /></div>
          <div className="flex flex-wrap items-center gap-2"><ScnStatus s={cycle.status} /><StatusPill tone="info">{l.prog(cycle.programme)}</StatusPill></div>
        </div>
        <div className="mt-3"><KeyValue items={[
          [t('m04.scn.plan.dates'), `${f.date(cycle.starts_on)} – ${f.date(cycle.ends_on)}`], [t('m04.scn.plan.segments'), t('m04.scn.plan.segmentsN', { n: cycle.segments, h: SEGMENT_MINUTES / 60 })],
          [t('m04.scn.plan.plannedBy'), cycle.planned_by ? `${people.name(cycle.planned_by)}${cycle.planned_at ? ` · ${f.date(cycle.planned_at)}` : ''}` : '—'],
          [t('m04.scn.plan.approvedBy'), cycle.approved_by ? `${people.name(cycle.approved_by)} · ${f.date(cycle.approved_at)}` : '—'],
        ]} /></div>
        {cycle.gap_note && <div className="mt-3"><Callout tone="sim" title={t('m04.scn.plan.gapNote')}>{cycle.gap_note}</Callout></div>}
      </Card>

      <Grid cols={4}>
        <div className="card flex items-center gap-3 p-4" data-testid="m04-scn-coverage-pct"><ProgressRing value={cov.pct} tone={cov.pct === 100 ? 'ok' : cov.pct >= 80 ? 'accent' : 'bad'} /><div><div className="caps">{t('m04.scn.plan.coverage')}</div><div className="text-[12.5px] text-ink-2">{t('m04.scn.plan.coverageSub', { covered: cov.covered, required: cov.required })}</div></div></div>
        <StatTile label={t('m04.scn.cover.under')} value={f.num(cov.under)} tone={cov.under ? 'sim' : 'ok'} sub={t('m04.scn.plan.underSub')} />
        <StatTile label={t('m04.scn.cover.missing')} value={f.num(cov.missing)} tone={cov.missing ? 'bad' : 'ok'} sub={t('m04.scn.plan.missingSub')} />
        <StatTile label={t('m04.scn.plan.runs')} value={f.num(cov.runs)} sub={t('m04.scn.plan.runsSub', { n: cov.planned_items })} />
      </Grid>

      <Card title={t('m04.scn.plan.board')} actions={canPlan ? (
        <div className="flex flex-wrap gap-2">
          {dirty && <button className="btn-ghost btn-sm" onClick={() => setDraft(saved)}><Icon name="reset" size={14} />{t('m04.scn.plan.reset')}</button>}
          <button className="btn-outline btn-sm" disabled={!dirty} onClick={() => setConfirm('save')} data-testid="m04-scn-plan-save">{t('m04.scn.plan.save')}</button>
          <button className="btn-primary btn-sm" onClick={() => setConfirm('submit')} data-testid="m04-scn-plan-submit">{t('m04.scn.plan.submit')}</button>
        </div>) : canApprove ? <button className="btn-primary btn-sm" onClick={() => setConfirm('approve')} data-testid="m04-scn-plan-approve">{t('m04.scn.plan.approve')}</button> : null}>
        {dirty && <p className="mb-2 text-[12.5px] text-sim" data-testid="m04-scn-plan-dirty">{t('m04.scn.plan.dirty')}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="m04-scn-board">
          {cov.segments.map((g) => {
            const here = draft.filter((d) => d.segment === g.segment);
            return (
              <div key={g.segment} className="flex min-w-0 flex-col gap-2 rounded-btn border border-line p-2.5" data-testid={`m04-scn-seg-${g.segment}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-semibold">{segLabel(g.segment)}</span><span className={`num text-[12px] ${g.over ? 'text-bad' : 'text-ink-3'}`}>{f.num(Math.round((g.minutes / 60) * 10) / 10)} / {f.num(SEGMENT_MINUTES / 60)} h</span></div>
                <ProgressBar value={(g.minutes * 100) / SEGMENT_MINUTES} tone={g.over ? 'bad' : 'accent'} label={segLabel(g.segment)} />
                <ul className="space-y-1">
                  {here.map((it) => {
                    const sc = lib.scMap.get(it.scenario_id)!;
                    return (
                      <li key={key(it)} className="flex items-start justify-between gap-1 rounded-btn bg-sunken px-2 py-1 text-[12.5px]">
                        <L to={`/training/simulator/scenarios/${sc.id}`} className="min-w-0"><span className="ltr me-1 text-ink-3">{sc.code}</span>{pick(sc, 'title')}</L>
                        {canPlan && <button type="button" className="text-ink-3 hover:text-bad" aria-label={t('m04.scn.plan.remove', { code: sc.code })} onClick={() => remove(it)}><Icon name="close" size={12} /></button>}
                      </li>
                    );
                  })}
                  {!here.length && <li className="text-[12px] text-ink-3">{t('m04.scn.plan.emptySegment')}</li>}
                </ul>
                {canPlan && (
                  <select className="input mt-auto text-[12.5px]" aria-label={t('m04.scn.plan.addTo', { n: g.segment })} value="" onChange={(e) => e.target.value && add({ scenario_id: e.target.value, segment: g.segment })} data-testid={`m04-scn-add-${g.segment}`}>
                    <option value="">{t('m04.scn.plan.addTo', { n: g.segment })}</option>
                    {usable.filter((x) => !here.some((h) => h.scenario_id === x.id)).map((x) => <option key={x.id} value={x.id}>{`${x.code} · ${pick(x, 'title')} (${x.duration_min} min)`}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={t('m04.scn.plan.matrix')} actions={<span className="text-[12px] text-ink-3">{t('m04.scn.plan.matrixHint')}</span>}>
          <div className="overflow-x-auto">
            <table className="table-base w-full min-w-[640px] border-collapse text-[12.5px]" data-testid="m04-scn-matrix">
              <caption className="sr-only">{t('m04.scn.plan.matrix')}</caption>
              <thead className="bg-raised"><tr>
                <th scope="col" className="text-start">{t('m04.scn.f.objective')}</th>
                {cov.segments.map((g) => <th key={g.segment} scope="col" className="w-8 text-center"><span className="num">{f.num(g.segment)}</span></th>)}
                <th scope="col" className="text-end">{t('m04.scn.plan.plannedMin')}</th><th scope="col" className="text-end">{t('m04.scn.plan.runs')}</th><th scope="col" className="text-start">{t('m04.common.status')}</th>
              </tr></thead>
              <tbody>
                {cov.rows.map((r) => {
                  const o = lib.objMap.get(r.objective_id);
                  return (
                    <tr key={r.objective_id} data-status={r.status} data-testid="m04-scn-matrix-row" className={r.status === 'missing' ? 'bg-bad-bg/40' : r.status === 'under' ? 'bg-sim-bg/40' : ''}>
                      <th scope="row" className="text-start font-normal"><span className="ltr me-1 text-ink-3">{o?.code}</span>{o ? pick(o, 'title') : r.objective_id}</th>
                      {cov.segments.map((g) => <td key={g.segment} className="text-center">{r.segments.includes(g.segment) ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" role="img" aria-label={t('m04.scn.plan.inSegment', { n: g.segment })} /> : <span className="text-ink-3">·</span>}</td>)}
                      <td className="num text-end">{f.num(r.planned)} / {f.num(r.min_runs)}</td>
                      <td className="num text-end">{f.num(r.runs)}</td>
                      <td><StatusPill tone={COVER_TONE[r.status]}>{l.cover(r.status)}</StatusPill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title={t('m04.scn.plan.suggest')} actions={<EngineBadge engine={eng} />}>
            {!ranked.length ? <p className="text-[13px] text-ink-2">{t('m04.scn.plan.noSuggest')}</p> : (
              <ol className="space-y-2" data-testid="m04-scn-suggest">
                {ranked.map((r) => {
                  const sc = r.item!;
                  const seg = firstFit(sc);
                  return (
                    <li key={r.id} className="rounded-btn border border-line p-2" data-testid="m04-scn-suggestion">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 text-[13px] font-medium"><span className="ltr me-1 text-ink-3">{(sc as never as { code: string }).code}</span>{pick(sc, 'title')}</span>
                        <CatChip c={sc.category} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <WhyThis reasons={r.reasons} testId="m04-scn-why" />
                        {canPlan && seg && <button className="btn-outline btn-sm" onClick={() => add({ scenario_id: sc.id, segment: seg })} data-testid="m04-scn-suggest-add"><Icon name="plus" size={12} />{t('m04.scn.plan.addToN', { n: seg })}</button>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          <Card title={t('m04.scn.plan.competencies')}>
            <div className="flex flex-wrap gap-1.5" data-testid="m04-scn-comp-cover">
              {cov.competencies.map((c) => { const k = lib.compMap.get(c.competency_id); return <StatusPill key={c.competency_id} tone={c.status === 'covered' ? 'ok' : 'bad'}><span title={k ? pick(k, 'name') : ''}><span className="ltr">{k?.code ?? c.competency_id}</span> · {f.num(c.planned)}</span></StatusPill>; })}
            </div>
          </Card>
          <Card title={t('m04.scn.plan.categories')}>
            <BarChart title={t('m04.scn.plan.categories')} data={Object.entries(cov.categories).map(([c, v]) => ({ label: l.cat(c), value: v, tone: v === 0 ? 'bad' : undefined }))} />
            {cov.missing_categories.length > 0 && <p className="mt-2 text-[12.5px] text-bad">{t('m04.scn.plan.categoryGap', { list: cov.missing_categories.map(l.cat).join('، ') })}</p>}
          </Card>
        </div>
      </div>
      <ConfirmDialog open={confirm === 'save' || confirm === 'submit'} onClose={() => setConfirm(null)} title={confirm === 'submit' ? t('m04.scn.plan.submit') : t('m04.scn.plan.save')}
        consequence={t(confirm === 'submit' ? 'm04.scn.plan.submitBody' : 'm04.scn.plan.saveBody', { n: draft.length, gaps })} confirmLabel={confirm === 'submit' ? t('m04.scn.plan.submit') : t('m04.scn.plan.save')}
        onConfirm={async () => { const sub = confirm === 'submit'; setConfirm(null); await doSave(sub); }} />
      <ConfirmDialog open={confirm === 'approve'} onClose={() => setConfirm(null)} title={t('m04.scn.plan.approve')} requireReason={gaps > 0} reasonLabel={t('m04.scn.plan.gapReason')}
        consequence={gaps > 0 ? t('m04.scn.plan.approveGaps', { gaps }) : t('m04.scn.plan.approveBody')} confirmLabel={t('m04.scn.plan.approve')}
        onConfirm={async (reason) => { setConfirm(null); await run(() => repo.rpc.approveCycle(cycle.id, reason || undefined)); }} />
    </div>
  );
}

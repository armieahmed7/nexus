// /training/simulator/scenarios/:scenarioId (M04 · F28, W4 · E3): one training scenario: metadata, objectives and competencies,
// cycles it is planned in, its revision history, recent crew debriefs, and the edit / review actions.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Async, Callout, Card, ConfirmDialog, EmptyState, KeyValue, Page, StatusPill, Timeline } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { SimScenariosRow } from '../../data/types';
import { meanScore } from './scenarios';
import { CatChip, DebriefDrawer, ScenarioEditor, ScnStatus, SourceChip, useSimDebriefs, useSimLabels, useSimLibrary } from './simUi';
import { Sources, usePeople } from './ui';
import type { SimDebriefView } from './backend/simulator.rpc';

type Hist = { at: string; by: string | null; action: string; revision: number; status: string; note?: string | null };

export default function TrainingScenarioPage() {
  const { scenarioId = '' } = useParams();
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const l = useSimLabels();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const lib = useSimLibrary();
  const deb = useSimDebriefs();
  const [edit, setEdit] = useState(false);
  const [review, setReview] = useState<'approve' | 'return' | 'retire' | null>(null);
  const [open, setOpen] = useState<SimDebriefView | null>(null);
  return (
    <Async state={lib}>
      {(L0) => {
        const x = L0.scenarios.find((r) => r.id === scenarioId) as SimScenariosRow | undefined;
        if (!x) return <Page title={t('m04.routes.training-sim-scenario.title')}><EmptyState title={t('m04.scn.detail.notFound')}><L to="/training/simulator/scenarios">{t('m04.scn.detail.back')}</L></EmptyState></Page>;
        const cycles = L0.cycles.map((c) => ({ c, segs: L0.items.filter((i) => i.cycle_id === c.id && i.active && i.scenario_id === x.id).map((i) => i.segment).sort((a, b) => a - b) })).filter((c) => c.segs.length);
        const runs = (deb.data ?? []).filter((d) => d.scenario_id === x.id);
        const hist = ((x.history as unknown as Hist[]) ?? []).slice().reverse();
        const canWrite = s.can('sat', ['W', 'A']) && x.status !== 'retired';
        const canReview = s.can('sat', ['A']) && x.status !== 'retired';
        return (
          <Page title={`${x.code} · ${pick(x, 'title')}`} eyebrow={t('m04.routes.training-sim-scenario.title')} wide actions={
            <div className="flex flex-wrap gap-2">
              {canWrite && <button className="btn-outline btn-sm" onClick={() => setEdit(true)} data-testid="m04-scn-edit">{x.status === 'approved' ? t('m04.scn.detail.revise') : t('m04.scn.detail.edit')}</button>}
              {canReview && x.status === 'in_review' && <button className="btn-outline btn-sm" onClick={() => setReview('return')}>{t('m04.scn.lib.return')}</button>}
              {canReview && x.status === 'in_review' && <button className="btn-primary btn-sm" disabled={x.last_edited_by === s.identity.personId} onClick={() => setReview('approve')} data-testid="m04-scn-detail-approve">{t('m04.scn.lib.approve')}</button>}
              {canReview && <button className="btn-ghost btn-sm" onClick={() => setReview('retire')}>{t('m04.scn.detail.retire')}</button>}
            </div>}>
            <div className="flex flex-wrap items-center gap-2" data-testid="m04-scn-detail">
              <CatChip c={x.category} /><ScnStatus s={x.status} /><StatusPill tone="neutral">{t('m04.scn.revShort', { n: x.revision })}</StatusPill>
              <StatusPill tone="ok">{t('m04.scn.detail.trainingOnly')}</StatusPill>
            </div>
            {x.review_note && <Callout tone={x.status === 'draft' ? 'sim' : 'info'} title={t('m04.scn.detail.reviewNote')}>{x.review_note}</Callout>}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Card title={t('m04.scn.detail.summary')}>
                  <p className="text-[14px]">{pick(x, 'summary')}</p>
                  {(x.events_en || x.events_ar) && <div className="mt-3"><div className="caps">{t('m04.scn.detail.events')}</div><p className="text-[13px] text-ink-2">{pick(x, 'events')}</p></div>}
                </Card>
                <Card title={t('m04.scn.f.objectives')}>
                  <ul className="divide-y divide-line text-[13px]" data-testid="m04-scn-detail-objectives">
                    {x.objective_ids.map((o) => { const ob = L0.objMap.get(o); return (
                      <li key={o} className="flex flex-wrap items-center justify-between gap-2 py-1.5"><span><span className="ltr me-1 text-ink-3">{ob?.code}</span>{ob ? pick(ob, 'title') : o}</span>{ob && <CatChip c={ob.category} />}</li>); })}
                  </ul>
                </Card>
                <Card title={t('m04.scn.detail.runs', { n: runs.length })}>
                  {!runs.length ? <p className="text-[13px] text-ink-2">{t('m04.scn.detail.noRuns')}</p> : (
                    <ul className="divide-y divide-line text-[13px]">
                      {runs.slice(0, 8).map((d) => (
                        <li key={d.id}><button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 py-1.5 text-start hover:text-accent" onClick={() => setOpen(d)}>
                          <span>{f.date(d.held_on)} · {t('m04.common.crew')} {d.crew} · {t('m04.scn.deb.meanN', { n: f.num(meanScore(d.ratings), { maximumFractionDigits: 2 }) })}</span>
                          <SourceChip source={d.source} evidence={d.members.reduce((n, m) => n + m.evidence, 0)} /></button></li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
              <div className="space-y-4">
                <Card title={t('m04.scn.detail.facts')}>
                  <KeyValue items={[
                    [t('m04.scn.f.duration'), t('m04.scn.minutes', { n: f.num(x.duration_min) })], [t('m04.scn.f.fidelity'), l.fid(x.fidelity)],
                    [t('m04.scn.f.positions'), x.positions.map(l.pos).join(', ')], [t('m04.scn.f.programmes'), x.programmes.map(l.prog).join(', ')],
                    [t('m04.scn.f.lastRun'), x.last_run_on ? f.date(x.last_run_on) : '—'], [t('m04.scn.detail.runCount'), f.num(x.run_count)],
                    [t('m04.scn.detail.author'), people.name(x.author_person_id)], [t('m04.scn.detail.approvedBy'), x.approved_by ? `${people.name(x.approved_by)} · ${f.date(x.approved_at)}` : '—'],
                  ]} />
                </Card>
                <Card title={t('m04.scn.f.competencies')}>
                  <div className="flex flex-wrap gap-1.5">{x.competency_ids.map((c) => { const k = L0.compMap.get(c); return <StatusPill key={c} tone="accent"><span className="ltr">{k?.code ?? c}</span>{k ? ` · ${pick(k, 'name')}` : ''}</StatusPill>; })}</div>
                </Card>
                <Card title={t('m04.scn.detail.cycles')}>
                  {!cycles.length ? <p className="text-[13px] text-ink-2">{t('m04.scn.detail.noCycles')}</p> : (
                    <ul className="space-y-1 text-[13px]">{cycles.map(({ c, segs }) => <li key={c.id}>{pick(c, 'label')} <span className="text-ink-3">· {t('m04.scn.detail.segmentsList', { list: segs.map((n) => f.num(n)).join(', ') })}</span></li>)}</ul>
                  )}
                </Card>
                <Card title={t('m04.scn.detail.history')}>
                  <Timeline items={hist.map((h, i) => ({ id: `${i}`, when: f.dateTime(h.at), title: t(`m04.scn.hist.${h.action}`, { n: h.revision }), detail: [h.by ? people.name(h.by) : null, h.note].filter(Boolean).join(' · '), tone: h.action === 'approve' ? 'ok' : h.action === 'return' ? 'sim' : 'neutral' }))} />
                </Card>
                <Sources items={x.sources} />
              </div>
            </div>
            {edit && <ScenarioEditor open onClose={() => setEdit(false)} lib={L0} initial={x} />}
            <DebriefDrawer d={open} onClose={() => setOpen(null)} />
            <ConfirmDialog open={!!review} onClose={() => setReview(null)} title={review ? t(`m04.scn.detail.${review}Title`, { code: x.code }) : ''} consequence={review ? t(`m04.scn.detail.${review}Body`) : ''}
              requireReason={review === 'return' || review === 'retire'} reasonLabel={t('m04.scn.lib.reason')} danger={review === 'retire'}
              onConfirm={async (reason) => { const d = review!; setReview(null); await run(() => repo.rpc.reviewSimScenario(x.id, d, reason || undefined)); }} />
          </Page>
        );
      }}
    </Async>
  );
}

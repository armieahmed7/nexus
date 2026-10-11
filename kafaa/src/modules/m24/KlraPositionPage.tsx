// /knowledge/klra/:positionId (M24 · F20): one position for the KM owner or its department head: the current deterministic
// proposal with every driver and its reasons, the quarterly history (total = attrition x position), the mitigation plan with
// owners and due dates (links to capture, mentoring, succession and cross-training degrade gracefully), and the capture sessions
// and knowledge assets tied to it. Bands only: no birth date, age or exact date.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, Callout, WhyThis, KeyValue, Timeline, SimChip, ConfirmDialog, Section } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { bandOf, mitigationState } from './klra';
import type { KlraAction, KlraPositionDetail } from './backend/rpc';
import { ActionPill, AssetPill, BandPill, Chips, FactorDots, MitigationPill, SessionPill, useKcLabels, useKcRefs } from './ui';
import { AssessModal, MitigationLink, MitigationModal } from './klraForms';

export default function KlraPositionPage() {
  const { positionId = '' } = useParams();
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['klra_assessments', 'klra_actions', 'klra_positions', 'klra_settings', 'knowledge_assets', 'capture_sessions'], () => repo.rpc.klraPosition(positionId), [positionId, s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-klra-position.title')} eyebrow={<L to="/knowledge/klra" className="link">{t('m24.klra.back')}</L>} wide>
      <Async state={q} isEmpty={(d) => !d} empty={<EmptyState icon="lock" title={t('m24.klra.positionNotFound')}>{t('m24.klra.positionNotFoundBody')}</EmptyState>}>
        {(d) => <Detail d={d!} />}
      </Async>
    </Page>
  );
}

function Detail({ d }: { d: KlraPositionDetail }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const refs = useKcRefs();
  const lab = useKcLabels(refs.data);
  const [assess, setAssess] = useState(false);
  const [plan, setPlan] = useState<{ id: string; title: string } | null>(null);
  const [close, setClose] = useState<{ a: KlraAction; outcome: 'done' | 'cancelled' } | null>(null);
  const p = d.position;
  const cur = d.history.find((h) => h.period === d.current) ?? null;
  const prop = d.proposal;
  const title = pick(p, 'title');
  const dr = prop.drivers;
  const driver = (k: string, v: number, extra?: string) => (
    <li key={k} className="flex items-center justify-between gap-3 py-1">
      <span className="text-[13px]">{t(`m24.driver.${k}`)}{extra ? <span className="text-ink-3"> · {extra}</span> : null}</span>
      <FactorDots value={v} label={t('m24.driver.scoreN', { n: v })} />
    </li>
  );
  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-start justify-between gap-4 p-5" data-testid="m24-position-head">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold">{title}</h2>
          <p className="text-[13px] text-ink-2">{pick({ holder_en: p.holder_en, holder_ar: p.holder_ar }, 'holder')} · {t(`m24.dept.${p.department}`)} · {lab.family(p.family_id)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.kind !== 'staff' && <span className="chip border-sim-line bg-sim-bg text-sim">{t(`m24.posKind.${p.kind}`)}</span>}
            <span className="chip border-line bg-sunken text-ink-2">{t(`m24.crit.${p.criticality}`)}</span>
            <SimChip label={t('m24.klra.feedAsOf', { date: f.date(p.feed_as_of) })} />
          </div>
        </div>
        <div className="text-end">
          {cur ? (
            <>
              <div className="caps">{t('m24.klra.currentTotal', { period: d.current })}</div>
              <div className="num text-[30px] font-semibold">{f.num(cur.total)}</div>
              <BandPill band={cur.band} /> <MitigationPill state={cur.mitigation} />
            </>
          ) : <Callout tone="sim">{t('m24.klra.notAssessedYet', { period: d.current })}</Callout>}
          <div className="mt-2"><button className="btn-primary btn-sm" onClick={() => setAssess(true)} data-testid="m24-position-assess">{cur ? t('m24.klra.reassessOne') : t('m24.klra.assess')}</button></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m24.klra.proposalTitle')} actions={<WhyThis reasons={prop.reasons} testId="m24-position-why" />}>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
            <FactorDots value={prop.attrition} label={t('m24.klra.attritionN', { n: prop.attrition })} /> × <FactorDots value={prop.position} label={t('m24.klra.positionN', { n: prop.position })} />
            <span className="num font-semibold">= {f.num(prop.total)}</span><BandPill band={bandOf(prop.total, d.thresholds)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="caps mb-1">{t('m24.klra.attrition')}</div>
              <ul className="divide-y divide-line">
                {driver('retire', dr.retire, t(`m24.retire.${p.retirement_band}`))}
                {driver('contract', dr.contract, t(`m24.contract.${p.contract_kind}`) + (p.contract_end_band !== 'none' ? ` · ${t(`m24.end.${p.contract_end_band}`)}` : ''))}
                {driver('ossa', dr.ossa)}
              </ul>
            </div>
            <div>
              <div className="caps mb-1">{t('m24.klra.position')}</div>
              <ul className="divide-y divide-line">
                {driver('crit', dr.crit)}
                {driver('uniq', dr.uniq, t('m24.driver.spofN', { n: f.num(dr.spof) }))}
                {driver('tacit', dr.tacit, t('m24.driver.codifiedPct', { n: f.num(dr.codified_pct) }))}
                {driver('repl', dr.repl, t('m24.driver.months', { n: f.num(p.replace_months) }))}
              </ul>
            </div>
          </div>
          {p.spof_skill_ids.length > 0 && <div className="mt-3"><div className="caps mb-1">{t('m24.klra.spofSkills')}</div><Chips items={p.spof_skill_ids.map(lab.skill)} /></div>}
          <p className="mt-3 text-[12px] text-ink-3">{t('m24.klra.bandsOnly')}</p>
        </Card>

        <Card title={t('m24.klra.mitigationTitle')} actions={cur ? <button className="btn-outline btn-sm" onClick={() => setPlan({ id: cur.id, title })} data-testid="m24-position-plan">{t('m24.klra.plan')}</button> : undefined}>
          {cur && cur.band === 'high' && cur.mitigation === 'needed' && <Callout tone="sim" title={t('m24.klra.neededTitle')}>{t('m24.klra.neededBody')}</Callout>}
          {cur && cur.mitigation === 'overdue' && <Callout tone="bad" title={t('m24.mitigation.overdue')}>{t('m24.klra.overdueBody')}</Callout>}
          {cur && cur.actions.length ? (
            <ul className="mt-2 space-y-2" data-testid="m24-position-actions">
              {cur.actions.map((a) => (
                <li key={a.id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{t(`m24.kind.${a.kind}`)}</span>
                    <ActionPill status={a.status} overdue={a.overdue} />
                  </div>
                  <div className="text-[12.5px] text-ink-2">{t('m24.klra.actionLine', { owner: t(`m24.owner.${a.owner_role}`), date: f.date(a.due_on) })}</div>
                  {a.note && <p className="mt-1 text-[13px]">{a.note}</p>}
                  {a.outcome && <p className="mt-1 text-[12.5px] text-ink-2">{t('m24.klra.outcome', { text: a.outcome })}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <MitigationLink kind={a.kind} personId={p.person_id} skillId={p.spof_skill_ids[0] ?? null} positionId={p.id} actionId={a.id} />
                    {(a.status === 'planned' || a.status === 'in_progress') && (
                      <>
                        <button className="btn-ghost btn-sm" onClick={() => setClose({ a, outcome: 'done' })} data-testid="m24-action-done">{t('m24.klra.markDone')}</button>
                        <button className="btn-ghost btn-sm" onClick={() => setClose({ a, outcome: 'cancelled' })}>{t('m24.klra.cancelAction')}</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="info" title={cur ? t('m24.klra.noActions') : t('m24.klra.assessFirst')} />}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title={t('m24.klra.historyTitle')}>
          <Timeline items={d.history.map((h) => ({
            id: h.id, when: h.period, tone: h.band === 'high' ? 'bad' : h.band === 'medium' ? 'sim' : 'ok',
            title: <span className="inline-flex flex-wrap items-center gap-2">{t('m24.klra.historyLine', { a: f.num(h.attrition_factor), p: f.num(h.position_factor), total: f.num(h.total) })}<BandPill band={h.band} /><MitigationPill state={mitigationState(h.band, h.period, h.actions, new Date().toISOString().slice(0, 10))} /></span>,
            detail: <span>{t('m24.klra.assessedBy', { name: pick({ name_en: h.assessed_by_name, name_ar: h.assessed_by_name_ar }, 'name'), date: f.date(h.assessed_at) })}{h.adjusted && h.note ? ` · ${t('m24.klra.adjustedNote', { note: h.note })}` : ''}</span>,
          }))} />
        </Section>
        <Section title={t('m24.klra.captureTitle')}>
          <KeyValue items={[
            [t('m24.klra.sessions'), d.sessions.length ? <ul className="space-y-1">{d.sessions.map((x) => <li key={x.id} className="flex flex-wrap items-center gap-2"><L to={`/knowledge/capture/${x.id}`} className="link">{x.title}</L><SessionPill status={x.status} /><span className="text-[12px] text-ink-3">{f.date(x.planned_on)}</span></li>)}</ul> : t('m24.klra.noSessions')],
            [t('m24.klra.assets'), d.assets.length ? <ul className="space-y-1">{d.assets.map((x) => <li key={x.id} className="flex flex-wrap items-center gap-2">{x.status === 'published' ? <L to={`/knowledge/assets/${x.id}`} className="link">{pick(x, 'title')}</L> : <span>{pick(x, 'title')}</span>}<AssetPill status={x.status} /></li>)}</ul> : t('m24.klra.noAssets')],
          ]} />
          <p className="mt-2 text-[12.5px] text-ink-2">{t('m24.method.loop')}</p>
        </Section>
      </div>

      <AssessModal positionId={assess ? p.id : null} title={title} onClose={() => setAssess(false)} />
      <MitigationModal assessment={plan} period={d.current} onClose={() => setPlan(null)} />
      <ConfirmDialog open={!!close} onClose={() => setClose(null)} title={close?.outcome === 'done' ? t('m24.klra.markDone') : t('m24.klra.cancelAction')}
        consequence={close?.outcome === 'done' ? t('m24.klra.doneBody') : t('m24.klra.cancelBody')} requireReason={close?.outcome === 'cancelled'} reasonLabel={t('m24.klra.reason')}
        onConfirm={async (reason) => { if (close) await run(() => repo.rpc.closeAction(close.a.id, close.outcome, reason)); }} />
    </div>
  );
}

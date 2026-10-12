// FS61 /workforce/pilots/:id (workforce_strategy Agg/R/W/A): one pilot. Hypothesis, comparison group (group sizes under 10 suppressed),
// the named independent evaluator, metrics against the comparison group, the evaluator's sign-off with the result (failures included) and
// lessons, and the adoption decision. HR (W/A) edits draft or running pilots and closes a signed-off pilot (rpc.closePilot: refused without
// the evaluator's sign-off; audit + ledger); closing publishes the result to staff, where a failure stays visible.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Section, Card, Async, ErrorState, KeyValue, Timeline, BarChart, Callout, SimChip, BenchmarkChips, ConfirmDialog, SelectField, StatusPill } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ADOPTIONS, FAILED_ALLOWED, lift, type Adoption, type PilotMetric } from './pilots';
import { AdoptionPill, GroupN, MetricUnit, Para, PilotStatusPill, ResultPill, SignoffForm, usePeople, usePersonName } from './fs60ui';
import { EditorHost } from './PilotsPage';
import type { Row } from './ui';

export default function PilotPage() {
  const t = useT();
  const { id = '' } = useParams();
  const repo = useRepo();
  const q = useQuery('skill_pilots', () => repo.get('skill_pilots', id) as Promise<Row | null>, [id]);
  return (
    <Async state={q} isEmpty={() => false}>{(p) => (p ? <Detail p={p} /> : (
      <Page title={t('m35.routes.workforce-pilot.title')}><ErrorState title={t('m35.spd.notFound')} /></Page>
    ))}</Async>
  );
}

function Detail({ p }: { p: Row }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const people = usePeople();
  const name = usePersonName(people.data);
  const repo = useRepo();
  const run = useAction();
  const me = s.identity.personId ?? '';
  const metrics = (p.metrics ?? []) as PilotMetric[];
  const canEdit = s.can('workforce_strategy', ['W', 'A']) && (p.status === 'draft' || p.status === 'running');
  const canClose = s.can('workforce_strategy', ['W', 'A']) && p.status !== 'closed';
  const signed = !!p.signoff_by && p.signoff_by === p.evaluator_person_id && p.status === 'evaluating';
  const closeBlock = !signed ? 'no_signoff' : p.evaluator_person_id === me ? 'maker_checker' : null;
  const options = p.result === 'failed' ? FAILED_ALLOWED : ADOPTIONS;
  const [adoption, setAdoption] = useState<Adoption>((p.recommendation as Adoption) ?? options[0]);
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const events = [
    { id: 'reg', when: f.date(p.created_at), title: t('m35.spd.ev.registered'), detail: name(p.created_by), tone: 'neutral' as const },
    ...(p.status !== 'draft' ? [{ id: 'start', when: f.date(p.start_on), title: t('m35.spd.ev.started'), detail: t('m35.spd.ev.window', { b: f.date(p.end_on) }), tone: 'info' as const }] : []),
    ...(p.signoff_at ? [{ id: 'sign', when: f.date(p.signoff_at), title: t('m35.spd.ev.signed'), detail: `${name(p.signoff_by)} · ${t(`m35.sp.result.${p.result}`)}`, tone: (p.result === 'failed' ? 'bad' : 'accent') as 'bad' | 'accent' }] : []),
    ...(p.closed_at ? [{ id: 'close', when: f.date(p.closed_at), title: t('m35.spd.ev.closed'), detail: `${name(p.closed_by)} · ${t(`m35.sp.adoption.${p.adoption}`)}`, tone: 'ok' as const }] : []),
  ];
  return (
    <Page title={pick(p, 'title')} intro={t('m35.spd.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS61" /><PilotStatusPill status={p.status} /><ResultPill result={p.result} /><SimChip /></div>}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/workforce/pilots" className="btn-ghost btn-sm no-underline">{t('m35.spd.back')}</L>
        {canEdit && <button type="button" className="btn-outline btn-sm" onClick={() => setEditing(true)} data-testid="m35-spd-edit">{t('m35.spd.edit')}</button>}
      </div>}>
      <div className="space-y-6" data-testid="m35-spd" data-id={p.id} data-status={p.status}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title={t('m35.spd.design')} className="lg:col-span-2">
            <div className="space-y-3">
              <Para label={t('m35.spd.hypothesis')}>{pick(p, 'hypothesis')}</Para>
              <Para label={t('m35.spd.comparison')}>{pick(p, 'comparison')}</Para>
            </div>
          </Card>
          <Card title={t('m35.spd.people')}>
            <KeyValue items={[
              [t('m35.spd.evaluator'), <span key="e" data-testid="m35-spd-evaluator">{name(p.evaluator_person_id)}</span>],
              [t('m35.spd.owner'), name(p.owner_person_id)],
              [t('m35.spd.pilotN'), <GroupN key="pn" n={p.pilot_n} />],
              [t('m35.spd.comparisonN'), <GroupN key="cn" n={p.comparison_n} />],
              [t('m35.spd.version'), <span key="v" className="num">{f.num(Number(p.version))}</span>],
            ]} />
            <p className="mt-2 text-[11.5px] text-ink-3">{t('m35.spd.independence')}</p>
          </Card>
        </div>
        <Section title={t('m35.spd.metrics')} description={t('m35.spd.metricsIntro')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <table className="w-full text-[13px]" data-testid="m35-spd-metrics">
              <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m35.spd.metric')}</th><th scope="col" className="py-1 text-end">{t('m35.spd.baseline')}</th><th scope="col" className="py-1 text-end">{t('m35.spd.target')}</th><th scope="col" className="py-1 text-end">{t('m35.spd.pilot')}</th><th scope="col" className="py-1 text-end">{t('m35.spd.comparisonValue')}</th><th scope="col" className="py-1 text-end">{t('m35.spd.lift')}</th></tr></thead>
              <tbody>
                {metrics.map((m) => { const l = lift(m); return (
                  <tr key={m.key} className="border-t border-line" data-key={m.key}>
                    <th scope="row" className="py-1.5 text-start font-medium">{pick(m as unknown as Row, 'label')}</th>
                    <td className="py-1.5 text-end"><MetricUnit m={m} v={m.baseline} /></td>
                    <td className="py-1.5 text-end"><MetricUnit m={m} v={m.target} /></td>
                    <td className="py-1.5 text-end"><MetricUnit m={m} v={m.pilot} /></td>
                    <td className="py-1.5 text-end"><MetricUnit m={m} v={m.comparison} /></td>
                    <td className="py-1.5 text-end"><span className="num">{l == null ? '—' : `${l > 0 ? '+' : ''}${f.num(l, { maximumFractionDigits: 1 })}`}</span></td>
                  </tr>
                ); })}
              </tbody>
            </table>
            {metrics.some((m) => m.pilot != null) && (
              <div data-testid="m35-spd-chart"><BarChart title={t('m35.spd.chart')} data={metrics.flatMap((m) => [
                { label: `${pick(m as unknown as Row, 'label')} · ${t('m35.spd.pilot')}`, value: m.pilot ?? null, tone: 'accent' },
                { label: `${pick(m as unknown as Row, 'label')} · ${t('m35.spd.comparisonValue')}`, value: m.comparison ?? null, tone: 'neutral', suppressed: m.comparison == null },
              ])} /></div>
            )}
          </div>
        </Section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title={t('m35.spd.result')}>
            {p.signoff_at ? (
              <div className="space-y-3" data-testid="m35-spd-result" data-result={p.result}>
                <div className="flex flex-wrap items-center gap-2"><ResultPill result={p.result} /><span className="text-[12.5px] text-ink-2">{t('m35.spd.recommends')}</span><AdoptionPill adoption={p.recommendation} /></div>
                <Para label={t('m35.spd.summary')}>{pick(p, 'result')}</Para>
                <Para label={t('m35.sp.lessons')}>{pick(p, 'lessons')}</Para>
                <p className="text-[11.5px] text-ink-3" data-testid="m35-spd-signoff">{t('m35.spd.signedBy', { who: name(p.signoff_by), date: f.date(p.signoff_at) })}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-ink-2" data-testid="m35-spd-awaiting">{t('m35.spd.awaitingSignoff', { who: name(p.evaluator_person_id) })}</p>
                {p.status === 'running' && p.evaluator_person_id === me && <SignoffForm pilot={p} />}
              </div>
            )}
          </Section>
          <Section title={t('m35.spd.decision')}>
            <div className="space-y-3" data-testid="m35-spd-decision">
              {p.status === 'closed' ? (
                <div className="space-y-1"><AdoptionPill adoption={p.adoption} /><p className="text-[12.5px] text-ink-2">{t('m35.spd.closedBy', { who: name(p.closed_by), date: f.date(p.closed_at) })}</p>
                  <StatusPill tone="ok">{t('m35.spd.published')}</StatusPill></div>
              ) : canClose ? (
                <>
                  <SelectField name="m35-spd-adoption" label={t('m35.spd.adoption')} value={adoption} onChange={(v) => setAdoption(v as Adoption)} options={options.map((a) => ({ value: a, label: t(`m35.sp.adoption.${a}`) }))} />
                  <button type="button" className="btn-primary btn-sm" disabled={!!closeBlock} onClick={() => setClosing(true)} data-testid="m35-spd-close" data-blocked={closeBlock ?? ''}>{t('m35.spd.close')}</button>
                  {closeBlock && <p className="text-[12.5px] text-ink-3" data-testid="m35-spd-close-why">{t(`m35.spd.blocked.${closeBlock}`)}</p>}
                </>
              ) : <p className="text-[13px] text-ink-3">{t('m35.spd.notClosed')}</p>}
            </div>
          </Section>
        </div>
        <Section title={t('m35.spd.history')}><Timeline items={events} /></Section>
        <Callout tone="info" title={t('m35.sp.failures.title')}>{t('m35.sp.failures.body')}</Callout>
        {closing && (
          <ConfirmDialog open onClose={() => setClosing(false)} title={t('m35.spd.closeTitle', { name: pick(p, 'title') })} consequence={t('m35.spd.closeConsequence')} actingAs={t('m35.hc.actingPreparer')} confirmLabel={t('m35.spd.close')}
            onConfirm={async () => { const r = await run(() => repo.rpc.closePilot(p.id, adoption)); if (r.ok) setClosing(false); }} />
        )}
        {editing && <EditorHost row={p} onClose={() => setEditing(false)} />}
      </div>
    </Page>
  );
}

// FS64 /ecosystem/regional-plan/commitments/:id: one provider commitment. Terms with planned seats, reported enrolment and completion kept
// in separate columns, and the delivery status per term and overall (computed by commitmentView; <WhyThis>). The provider administrator
// (ecosystem OrgW, own organisation) reports a started term's delivery, revises future terms (started terms are locked) or withdraws with
// a reason; HR (ecosystem W) acknowledges or queries. Every action is an RPC behind a ConfirmDialog. RLS returns nothing for another
// organisation's commitment, so it reads as not found.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, EmptyState, KeyValue, Timeline, ConfirmDialog, WhyThis, BenchmarkChips, ProgressBar, TextField, SelectField, StatusPill } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { commitmentView, deliveryProblem, type PlanEntry } from './regional';
import { CommitForm } from './CommitForm';
import { CommitStatusPill, DemoLabels, HrPill, TermStatusPill, useOrgName, useSkillName, useSkills, useTermLabel, type Row } from './ui';

export default function CommitmentPage() {
  const t = useT();
  const repo = useRepo();
  const { id = '' } = useParams();
  const c = useQuery('provider_commitments' as Table, async () => ({ row: (await repo.get('provider_commitments' as never, id)) as unknown as Row | null }), [id]);
  return (
    <Page title={t('m36.routes.ecosystem-commitment.title')} intro={t('m36.cd.intro')} wide eyebrow={<BenchmarkChips feature="FS64" />}
      actions={<L to="/ecosystem/regional-plan/commitments" className="btn-outline btn-sm no-underline">{t('m36.cd.back')}</L>}>
      <Async state={c}>{(d) => (d.row ? <Detail c={d.row} /> : <EmptyState title={t('m36.cd.notFound')}>{t('m36.cd.notFoundBody')}</EmptyState>)}</Async>
    </Page>
  );
}

function Detail({ c }: { c: Row }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const orgName = useOrgName();
  const termLabel = useTermLabel();
  const skills = useSkills();
  const skillName = useSkillName(skills.data);
  const demand = useQuery('regional_demand' as Table, () => repo.list('regional_demand' as never, { filter: { status: 'current' } } as never) as unknown as Promise<Row[]>);
  const today = todayIso();
  const v = commitmentView(c, today);
  const own = !!s.identity.orgId && s.identity.orgId === c.org_id && s.can('ecosystem', ['OrgW']);
  const hr = s.can('ecosystem', ['W', 'A']);
  const activeRow = c.status === 'active';
  const plan = (c.plan ?? []) as PlanEntry[];
  const started = plan.filter((p) => v.terms.find((x) => x.term === p.term)?.state !== 'future');
  const [term, setTerm] = useState<string>(started.at(-1)?.term ?? '');
  const [enrolled, setEnrolled] = useState('');
  const [completed, setCompleted] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [revise, setRevise] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [review, setReview] = useState<'acknowledged' | 'queried' | null>(null);
  const delInput = { commitment_id: c.id, term, enrolled: enrolled === '' ? NaN : Number(enrolled), completed: completed === '' ? NaN : Number(completed) };
  const delProblem = deliveryProblem(delInput, plan, today);
  const history = ((c.history ?? []) as Row[]).slice().reverse();
  return (
    <div className="space-y-6" data-testid="m36-cd" data-id={c.id} data-status={v.status}>
      <DemoLabels>{c.sample && <StatusPill tone="sim">{t('m36.sample')}</StatusPill>}</DemoLabels>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Card title={pick(c, 'title')} eyebrow={orgName(c)}>
          <div className="space-y-3">
            <p className="text-[13.5px] text-ink-2" data-testid="m36-cd-summary">{pick(c, 'summary')}</p>
            <KeyValue items={[
              [t('m36.cd.area'), t(`m36.area.${c.area}`)],
              [t('m36.cd.kind'), t(`m36.kind.${c.kind}`)],
              [t('m36.cd.level'), t(`m36.level.${c.level}`)],
              [t('m36.cd.release'), <span key="r" className="num">{c.release_id}</span>],
              [t('m36.cd.version'), <span key="v" className="num">{f.num(Number(c.version))}</span>],
            ]} />
            {(c.skill_ids as string[]).length > 0 && <div className="flex flex-wrap gap-1" data-testid="m36-cd-skills">{(c.skill_ids as string[]).map((id) => <span key={id} className="rounded bg-sunken px-1.5 py-0.5 text-[12px]">{skillName(id)}</span>)}</div>}
          </div>
        </Card>
        <Card title={t('m36.cd.statusTitle')}>
          <div className="space-y-2" data-testid="m36-cd-status">
            <div className="flex flex-wrap items-center gap-2"><CommitStatusPill status={v.status} /><WhyThis reasons={v.reasons} testId="m36-cd-why" /></div>
            <div className="flex flex-wrap items-center gap-2 text-[13px]"><span>{t('m36.cd.enec')}</span><HrPill status={c.hr_status} /></div>
            {c.hr_note && <p className="rounded bg-sunken p-2 text-[12.5px]" data-testid="m36-cd-hr-note">{c.hr_note}</p>}
            {c.status === 'withdrawn' && <p className="text-[12.5px] text-ink-2" data-testid="m36-cd-withdrawn">{t('m36.cd.withdrawnReason', { reason: c.withdrawn_reason ?? '' })}</p>}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center" data-testid="m36-cd-totals">
              <div><span className="caps block">{t('m36.cm.col.seats')}</span><span className="num text-[18px] font-semibold">{f.num(v.seats)}</span></div>
              <div><span className="caps block">{t('m36.cm.col.enrolled')}</span><span className="num text-[18px] font-semibold">{f.num(v.enrolled)}</span></div>
              <div><span className="caps block">{t('m36.cm.col.completed')}</span><span className="num text-[18px] font-semibold">{f.num(v.completed)}</span></div>
            </div>
          </div>
        </Card>
      </div>
      <Section title={t('m36.cd.terms')} description={t('m36.cd.termsIntro')}>
        <div className="overflow-x-auto" data-testid="m36-cd-terms">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{t('m36.cd.terms')}</caption>
            <thead><tr className="text-ink-3">
              <th scope="col" className="py-1 text-start font-semibold">{t('m36.cd.term')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.cm.col.seats')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.cm.col.enrolled')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.cm.col.completed')}</th>
              <th scope="col" className="py-1 ps-3 text-start font-semibold">{t('m36.cd.filled')}</th>
              <th scope="col" className="py-1 text-start font-semibold">{t('m36.cm.col.status')}</th>
            </tr></thead>
            <tbody>{v.terms.map((x) => (
              <tr key={x.term} className="border-t border-line" data-testid="m36-cd-term" data-term={x.term} data-state={x.state}>
                <th scope="row" className="py-1.5 text-start font-medium">{termLabel(x.term)}<span className="block text-[11.5px] font-normal text-ink-3">{t(`m36.termState.${x.state}`)}</span></th>
                <td className="py-1.5 text-end num">{f.num(x.seats)}</td>
                <td className="py-1.5 text-end num">{x.enrolled == null ? '—' : f.num(x.enrolled)}</td>
                <td className="py-1.5 text-end num">{x.completed == null ? '—' : f.num(x.completed)}</td>
                <td className="py-1.5 ps-3">{x.pct == null ? <span className="text-ink-3">—</span> : <ProgressBar value={Math.min(100, x.pct)} tone={x.pct >= 90 ? 'ok' : x.pct >= 60 ? 'sim' : 'bad'} label={`${f.num(x.pct)}%`} />}</td>
                <td className="py-1.5"><TermStatusPill status={x.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>
      {own && activeRow && (
        <Section title={t('m36.cd.report')} description={t('m36.cd.reportIntro')}>
          {started.length ? (
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4" data-testid="m36-cd-report">
              <SelectField name="term" label={t('m36.cd.term')} value={term} onChange={setTerm} options={started.map((p) => ({ value: p.term, label: termLabel(p.term) }))} />
              <TextField name="enrolled" type="number" label={t('m36.cm.col.enrolled')} value={enrolled} onChange={setEnrolled} />
              <TextField name="completed" type="number" label={t('m36.cm.col.completed')} value={completed} onChange={setCompleted} />
              <button type="button" className="btn-primary" disabled={!!delProblem} onClick={() => setConfirmDel(true)} data-testid="m36-cd-report-submit">{t('m36.cd.reportSave')}</button>
              {delProblem && (enrolled !== '' || completed !== '') && <p className="text-[12.5px] text-bad md:col-span-4" data-testid="m36-cd-report-problem" data-problem={delProblem}>{t(`m36.problem.delivery.${delProblem}`)}</p>}
            </div>
          ) : <p className="text-[13px] text-ink-3">{t('m36.cd.noStarted')}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => setRevise(true)} data-testid="m36-cd-revise">{t('m36.cd.revise')}</button>
            <button type="button" className="btn-outline btn-sm text-bad" onClick={() => setWithdraw(true)} data-testid="m36-cd-withdraw">{t('m36.cd.withdraw')}</button>
          </div>
        </Section>
      )}
      {hr && activeRow && !own && (
        <Section title={t('m36.cd.reviewTitle')} description={t('m36.cd.reviewIntro')}>
          <div className="flex flex-wrap gap-2" data-testid="m36-cd-review">
            <button type="button" className="btn-primary btn-sm" onClick={() => setReview('acknowledged')} data-testid="m36-cd-ack">{t('m36.cd.ack')}</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setReview('queried')} data-testid="m36-cd-query">{t('m36.cd.query')}</button>
          </div>
        </Section>
      )}
      <Section title={t('m36.cd.history')}>
        <div data-testid="m36-cd-history">
          <Timeline items={history.map((h, i) => ({
            id: `${i}`, when: h.at ? f.dateTime(h.at) : '—', tone: h.action === 'withdraw' ? 'neutral' : h.action === 'create' ? 'ok' : 'info',
            title: t(`m36.cd.hist.${h.action}`, { v: f.num(Number(h.version ?? 1)) }),
            detail: h.reason ? String(h.reason) : Array.isArray(h.plan) ? (h.plan as PlanEntry[]).map((p) => `${termLabel(p.term)}: ${f.num(p.seats)}`).join(' · ') : undefined,
          }))} />
        </div>
      </Section>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} title={t('m36.cd.reportConfirm')} consequence={t('m36.cd.reportConsequence', { term: termLabel(term) })}
        actingAs={t('m36.form.actingAs')} confirmLabel={t('m36.cd.reportSave')}
        onConfirm={async () => { const r = await run(() => repo.rpc.reportCommitmentDelivery(delInput)); if (r.ok) { setEnrolled(''); setCompleted(''); } setConfirmDel(false); }} />
      <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} title={t('m36.cd.withdrawConfirm')} consequence={t('m36.cd.withdrawConsequence')} requireReason reasonLabel={t('m36.cd.withdrawReason')}
        danger confirmLabel={t('m36.cd.withdraw')} onConfirm={async (reason) => { await run(() => repo.rpc.commitProvision({ ...c, id: c.id, action: 'withdraw', reason } as never)); setWithdraw(false); }} />
      <ConfirmDialog open={review !== null} onClose={() => setReview(null)} title={review === 'queried' ? t('m36.cd.queryConfirm') : t('m36.cd.ackConfirm')}
        consequence={review === 'queried' ? t('m36.cd.queryConsequence') : t('m36.cd.ackConsequence')} requireReason={review === 'queried'} reasonLabel={t('m36.cd.queryNote')}
        actingAs={t('m36.cd.actingHr')} confirmLabel={review === 'queried' ? t('m36.cd.query') : t('m36.cd.ack')}
        onConfirm={async (note) => { await run(() => repo.rpc.reviewCommitment({ commitment_id: c.id, decision: review ?? 'acknowledged', note })); setReview(null); }} />
      {revise && <CommitForm open={revise} onClose={() => setRevise(false)} current={c} demand={demand.data ?? []} skills={skills.data} />}
    </div>
  );
}

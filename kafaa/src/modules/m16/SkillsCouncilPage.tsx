// /admin/skills-council (M16 · FS54): the skills council queue. Council members (skills_taxonomy A: training manager, HR director, platform
// admin) vote on proposed changes; auditors read. Maker-checker: two different members, neither of them the proposer; the first vote
// approves or rejects, a second member who agrees closes the request (a published change is applied to the catalogue and logged
// publicly), one who disagrees sends it back. Every vote is confirmed and writes a NEXUS ledger row. Each request shows the inclusion
// rule against today's catalogue and a preview of what publishing would change.
import { useMemo, useState } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Callout, EmptyState, Icon, Page, StatTile, Tabs } from '../../ui';
import { todayIso } from '../../domain/rules';
import { changePlan, decideProblem, inclusionChecks, LIMITS, OPEN_STATUSES, type Decision, type RequestRow, type SkillLite } from './taxonomyGov';
import { CouncilSteps, InclusionList, KindPill, RequestStatusPill, VoteList, useRoleLabel } from './govUi';
import { GatedConfirm } from './parts';
import { useGovAction } from './govAction';

export default function SkillsCouncilPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['skill_change_requests', 'skill_changes', 'skills', 'competencies'], async () => ({
    queue: await repo.rpc.skillCouncilQueue().catch(() => null),
    skills: (await repo.list('skills')) as unknown as SkillLite[],
    comps: (await repo.list('competencies').catch(() => [])).map((c) => c.id as string),
  }), [s.identity.personId]);
  return (
    <Page title={t('m16.routes.admin-skills-council.title')} eyebrow={<BenchmarkChips feature="FS54" />} intro={t('m16.gov.cn.intro')} wide>
      <Async state={q} isEmpty={(d) => !d.queue} empty={<EmptyState icon="lock" title={t('m16.gov.cn.noAccess')} />}>
        {(d) => <Council queue={d.queue!} skills={d.skills} comps={d.comps} reload={() => q.reload?.()} />}
      </Async>
    </Page>
  );
}

function Council({ queue, skills, comps, reload }: { queue: RequestRow[]; skills: SkillLite[]; comps: string[]; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const canDecide = s.can('skills_taxonomy', ['A']);
  const open = queue.filter((r) => OPEN_STATUSES.includes(r.status));
  const second = open.filter((r) => r.status !== 'submitted');
  const today = todayIso();
  const recent = queue.filter((r) => r.decided_at && Date.parse(today) - Date.parse(r.decided_at) <= 90 * 86_400_000);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m16-council-tiles">
        <StatTile label={t('m16.gov.cn.tile.open')} value={f.num(open.length)} tone={open.length ? 'info' : 'ok'} />
        <StatTile label={t('m16.gov.cn.tile.second')} value={f.num(second.length)} sub={t('m16.gov.cn.tile.secondSub')} tone={second.length ? 'sim' : undefined} />
        <StatTile label={t('m16.gov.cn.tile.published')} value={f.num(recent.filter((r) => r.status === 'published').length)} tone="ok" sub={t('m16.gov.cn.tile.days')} />
        <StatTile label={t('m16.gov.cn.tile.rejected')} value={f.num(queue.filter((r) => r.status === 'rejected').length)} />
      </div>
      {!canDecide && <Callout tone="sim" title={t('m16.gov.cn.readOnlyTitle')}>{t('m16.gov.cn.readOnly')}</Callout>}
      <Tabs initial="open" tabs={[
        { id: 'open', label: t('m16.gov.cn.tab.open'), badge: open.length, content: <RequestList rows={open} skills={skills} comps={comps} canDecide={canDecide} reload={reload} /> },
        { id: 'decided', label: t('m16.gov.cn.tab.decided'), content: <RequestList rows={queue.filter((r) => !OPEN_STATUSES.includes(r.status))} skills={skills} comps={comps} canDecide={false} reload={reload} /> },
      ]} />
      <Callout title={t('m16.gov.cn.rulesTitle')}>
        <ul className="list-disc space-y-1 ps-4">{(['two', 'proposer', 'ledger', 'obsolete', 'banner'] as const).map((k) => <li key={k}>{t(`m16.gov.cn.rules.${k}`)}</li>)}</ul>
        <p className="mt-2 text-[12.5px]"><L to="/skills/changes" className="link">{t('m16.gov.cn.toLog')}</L> · <L to="/admin/skills-health" className="link">{t('m16.gov.cn.toHealth')}</L></p>
      </Callout>
    </div>
  );
}

function RequestList({ rows, skills, comps, canDecide, reload }: { rows: RequestRow[]; skills: SkillLite[]; comps: string[]; canDecide: boolean; reload: () => void }) {
  const t = useT();
  if (!rows.length) return <EmptyState icon="check" title={t('m16.gov.cn.none')} />;
  return (
    <ul className="space-y-3" data-testid="m16-council-list">
      {rows.slice(0, 60).map((r) => <RequestCard key={r.id} r={r} skills={skills} comps={comps} canDecide={canDecide} reload={reload} />)}
    </ul>
  );
}

function RequestCard({ r, skills, comps, canDecide, reload }: { r: RequestRow; skills: SkillLite[]; comps: string[]; canDecide: boolean; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useGovAction();
  const role = useRoleLabel();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const me = s.identity.personId ?? '';
  const isOpen = OPEN_STATUSES.includes(r.status);
  const target = r.skill_id ? skills.find((x) => x.id === r.skill_id) ?? null : null;
  const checks = useMemo(() => (isOpen ? inclusionChecks({ kind: r.kind, skill_id: r.skill_id, proposal: r.proposal, rationale: r.rationale, development: r.development, assessment: r.assessment }, skills, comps) : r.inclusion), [isOpen, r, skills, comps]);
  const blocked = canDecide && isOpen ? decideProblem(r, me, 'approve', 'x'.repeat(LIMITS.note)) : null;
  const plan = useMemo(() => {
    if (!isOpen || !checks.every((c) => c.ok)) return null;
    try { return changePlan(r, skills, todayIso()); } catch { return null; }
  }, [isOpen, checks, r, skills]);
  const votes = Array.isArray(r.votes) ? r.votes : [];
  const noteBad = decision != null && ((decision === 'reject' && note.trim().length < LIMITS.note) || note.trim().length > LIMITS.noteMax);
  const nextLabel = r.status === 'submitted' ? 'first' : r.first_decision === decision ? 'final' : 'differ';
  return (
    <li className="card min-w-0 space-y-3 p-4" data-testid="m16-request" data-id={r.id} data-status={r.status} data-kind={r.kind}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <KindPill kind={r.kind} /><RequestStatusPill status={r.status} />
            {target && <span className="chip border-line bg-sunken font-mono text-[11px]" dir="ltr">{target.code}</span>}
            <span className="chip border-line bg-sunken font-mono text-[11px]" dir="ltr">{r.id}</span>
          </div>
          <h3 className="text-[15.5px] font-semibold leading-snug">{pick(r, 'title')}</h3>
          <p className="text-[12px] text-ink-3">{t('m16.gov.cn.proposed', { role: role(r.proposed_role), date: f.date(r.proposed_at) })}</p>
        </div>
        <CouncilSteps status={r.status} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="min-w-0 space-y-2 text-[13px] lg:col-span-2">
          <p><span className="caps me-1">{t('m16.gov.cn.rationale')}</span>{r.rationale}</p>
          <p><span className="caps me-1">{t('m16.gov.cn.development')}</span>{r.development}</p>
          <p><span className="caps me-1">{t('m16.gov.cn.assessment')}</span>{r.assessment}</p>
          {plan && (
            <div className="rounded-btn border border-info-line bg-info-bg p-2 text-[12.5px] text-info" data-testid="m16-request-plan">
              <p className="font-semibold"><Icon name="info" size={12} /> {t('m16.gov.cn.planTitle')}</p>
              <p>{pick(plan.change, 'summary')}</p>
              {plan.inserts.length > 0 && <p>{t('m16.gov.cn.planNew', { ids: plan.inserts.map((x) => x.code).join(', ') })}</p>}
              {(r.kind === 'retire' || r.kind === 'split') && <p>{t('m16.gov.cn.planObsolete')}</p>}
              {plan.change.methodology && <p>{t('m16.gov.cn.planBanner')}</p>}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <div><div className="caps mb-1">{isOpen ? t('m16.gov.cn.inclusionNow') : t('m16.gov.cn.inclusionThen')}</div><InclusionList checks={checks} compact /></div>
          <div><div className="caps mb-1">{t('m16.gov.cn.votes')}</div><VoteList votes={votes} /></div>
        </div>
      </div>
      {canDecide && isOpen && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
          {blocked ? <p className="me-auto flex items-center gap-1 text-[12.5px] text-ink-3" data-testid="m16-request-blocked"><Icon name="lock" size={12} />{t(`m16.gov.msg.${blocked}`)}</p>
            : <p className="me-auto text-[12.5px] text-ink-3">{r.status === 'submitted' ? t('m16.gov.cn.firstHint') : t('m16.gov.cn.secondHint', { decision: t(`m16.gov.decision.${r.first_decision}`) })}</p>}
          <button className="btn-outline btn-sm" disabled={!!blocked} onClick={() => { setDecision('reject'); setNote(''); }} data-testid="m16-request-reject">{t('m16.gov.cn.reject')}</button>
          <button className="btn-primary btn-sm" disabled={!!blocked || !checks.every((c) => c.ok)} onClick={() => { setDecision('approve'); setNote(''); }} data-testid="m16-request-approve">{t('m16.gov.cn.approve')}</button>
        </div>
      )}
      <GatedConfirm open={decision != null} onClose={() => setDecision(null)} danger={decision === 'reject'} ready={!noteBad}
        title={t(`m16.gov.cn.confirm.${decision ?? 'approve'}`, { title: pick(r, 'title') })} consequence={t(`m16.gov.cn.consequence.${nextLabel}`)} actingAs={t('m16.gov.cn.actingAs')}
        onConfirm={async () => { const res = await act(() => repo.rpc.decideSkillChange(r.id, decision!, note.trim() || null), t(`m16.gov.cn.done.${nextLabel === 'final' ? (decision === 'approve' ? 'published' : 'rejected') : nextLabel}`)); if (res.ok) reload(); }}>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold">{decision === 'reject' ? t('m16.gov.cn.noteRequired') : t('m16.gov.cn.noteOptional')}</span>
          <textarea className="input" rows={3} maxLength={LIMITS.noteMax} value={note} onChange={(e) => setNote(e.target.value)} data-testid="m16-request-note" />
          {noteBad && <span className="text-[12px] text-bad" role="alert">{t('m16.gov.msg.note')}</span>}
        </label>
      </GatedConfirm>
    </li>
  );
}

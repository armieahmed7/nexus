// /my/plan (M04): individual development plan towards a target role. Skills gap from the competency framework (M02),
// suggested courses, activities and milestones, submission for line-manager approval. Managers approve their team's plans here.
import { useMemo, useState } from 'react';
import { Page, Grid, Card, Section, KeyValue, Async, EmptyState, ConfirmDialog, Modal, DataTable, ProgressRing, Callout, Icon, SelectField, TextField, TextArea, useForm, required, maxLen, Skeleton, WhyThis, AddToCalendar } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { DevPlansRow, PlanActivitiesRow } from '../../data/types';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Chip, G2Pill, useLabels, usePeople } from './ui';
import { rankPlanSuggestions } from './plan';
import { useCalendarEvents } from '../../shell/calendar/useCalendarEvents'; // SHR-01
import { upcomingOnly } from '../../domain/ics';

const KINDS = ['course', 'ojt', 'mentoring', 'project', 'assessment', 'reading'] as const;

export default function MyPlanPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const me = s.identity.personId;
  const plans = useQuery(['dev_plans', 'plan_activities'], async () => {
    const [mine, acts] = await Promise.all([repo.list('dev_plans', { filter: { person_id: me ?? '' }, order: [['created_at', 'desc']] }), repo.list('plan_activities', { filter: { person_id: me ?? '' } })]);
    return { mine, acts };
  }, [me]);
  const manager = s.can('dev_plans', ['A']);
  return (
    <Page title={t('m04.routes.my-plan.title')} intro={t('m04.plan.intro')}
      actions={<L to="/my/future-wallet" className="btn-outline btn-sm no-underline" data-testid="m04-plan-to-wallet">{t('m04.plan.toWallet')}</L>}>{/* FS74 (wave-H integration) */}
      <Async state={plans} isEmpty={() => false}>
        {(d) => {
          const plan = d.mine.find((p) => p.status !== 'closed') ?? null;
          return plan ? <PlanView plan={plan} acts={d.acts.filter((a) => a.plan_id === plan.id)} /> : <NewPlan />;
        }}
      </Async>
      {manager && <TeamPlans />}
    </Page>
  );
}

function NewPlan() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const roles = useQuery('job_roles', () => repo.list('job_roles', { order: [['sort', 'asc']] }), []);
  const form = useForm({ target: '', review: '', note: '' }, { target: [required()], note: [maxLen(500)] });
  return (
    <Card title={t('m04.plan.createTitle')}>
      <p className="mb-3 text-ink-2">{t('m04.plan.createBody')}</p>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={form.handleSubmit(async (v) => {
        await run(() => repo.insert('dev_plans', { person_id: s.identity.personId!, target_role_id: v.target, status: 'draft', review_on: v.review || null, note: v.note || null }), { success: t('m04.plan.created') });
      })} data-testid="m04-plan-create">
        <SelectField label={t('m04.plan.target')} required options={(roles.data ?? []).filter((r) => r.id !== s.person?.job_role_id).map((r) => ({ value: r.id, label: pick(r, 'title') }))} {...form.field('target')} />
        <TextField label={t('m04.plan.reviewOn')} type="date" {...form.field('review')} />
        <TextField label={t('m04.plan.note')} {...form.field('note')} />
        <div className="sm:col-span-3"><button className="btn-primary" type="submit" disabled={form.submitting}>{t('m04.plan.create')}</button></div>
      </form>
    </Card>
  );
}

function PlanView({ plan, acts }: { plan: DevPlansRow; acts: PlanActivitiesRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const people = usePeople();
  const cal = useCalendarEvents();
  const [adding, setAdding] = useState<{ kind: string; title_en: string; title_ar: string; course_id: string | null } | null>(null);
  const [submit, setSubmit] = useState(false);
  const me = s.identity.personId ?? '';
  const fw = useQuery(['job_roles', 'role_competencies', 'competencies', 'courses', 'enrolments', 'qual_records', 'qual_standards'], async () => {
    const [roles, rc, comps, courses, enrolments, quals, standards] = await Promise.all([repo.list('job_roles'), repo.list('role_competencies'), repo.list('competencies'), repo.list('courses'),
      // EMP-02: my own enrolments and qualifications, so suggestions leave out what I have done, am doing or have qualified past
      repo.list('enrolments', { filter: { person_id: me } }).catch(() => []), repo.list('qual_records', { filter: { person_id: me } }).catch(() => []), repo.list('qual_standards').catch(() => [])]);
    return { roles, rc, comps, courses, enrolments, quals, standards };
  }, [me]);
  const editable = plan.status === 'draft' || plan.status === 'active';
  const done = acts.filter((a) => a.status === 'done').length;
  const pct = acts.length ? Math.round((done * 100) / acts.length) : 0;
  const setStatus = (a: PlanActivitiesRow, status: PlanActivitiesRow['status']) => run(() => repo.update('plan_activities', a.id, { status }), { success: t('m04.plan.activitySaved') });

  return (
    <Async state={fw}>
      {(d) => {
        const role = d.roles.find((r) => r.id === plan.target_role_id);
        const current = s.person?.job_role_id ?? null;
        const need = d.rc.filter((x) => x.role_id === plan.target_role_id);
        const have = new Map(d.rc.filter((x) => x.role_id === current).map((x) => [x.competency_id, x.required_level]));
        const gaps = need.map((x) => ({ ...x, have: have.get(x.competency_id) ?? 0, gap: x.required_level - (have.get(x.competency_id) ?? 0) })).filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap);
        const comp = (id: string) => d.comps.find((c) => c.id === id);
        const planned = new Set(acts.map((a) => a.course_id).filter((x): x is string => !!x));
        const suggestions = rankPlanSuggestions({
          gaps, courses: d.courses, planned, enrolments: d.enrolments, roleId: current, quals: d.quals, standards: d.standards,
          compName: (id) => { const c = comp(id); return c ? { en: `${c.code} · ${c.name_en}`, ar: `${c.code} · ${c.name_ar || c.name_en}` } : null; },
        });
        return (
          <div className="space-y-6">
            <Grid cols={3}>
              <Card title={t('m04.plan.target')} className="sm:col-span-2" actions={<G2Pill status={plan.status} tone={plan.status === 'active' ? 'ok' : plan.status === 'submitted' ? 'info' : 'neutral'} />}>
                <div className="text-[18px] font-semibold">{role ? pick(role, 'title') : plan.target_role_id}</div>
                <div className="mt-2"><KeyValue items={[
                  [t('m04.plan.current'), current ? pick(d.roles.find((r) => r.id === current), 'title') : '—'],
                  [t('m04.plan.reviewOn'), f.date(plan.review_on)],
                  [t('m04.plan.approvedBy'), plan.approved_by ? people.name(plan.approved_by) : '—'],
                  ...(plan.decision_note ? [[t('m04.plan.managerNote'), plan.decision_note] as [string, string]] : []),
                ]} /></div>
                {role && <L to={`/careers/roles/${role.id}`} className="mt-3 inline-flex items-center gap-1 text-[13px]">{t('m04.plan.roleProfile')}<Icon name="chevron" size={14} /></L>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.status === 'draft' && <button className="btn-primary btn-sm" disabled={acts.length === 0} onClick={() => setSubmit(true)} data-testid="m04-plan-submit">{t('m04.plan.submit')}</button>}
                  {plan.status === 'draft' && acts.length === 0 && <span className="text-[12.5px] text-ink-3">{t('m04.plan.addFirst')}</span>}
                  {plan.status === 'submitted' && <Chip tone="info">{t('m04.plan.awaiting')}</Chip>}
                </div>
              </Card>
              <Card title={t('m04.plan.progress')}>
                <div className="flex items-center gap-4"><ProgressRing value={pct} size={72} tone={pct === 100 ? 'ok' : 'accent'} name={t('m04.plan.progress')} /><div className="text-[13.5px] text-ink-2">{t('m04.plan.progressBody', { done: f.num(done), total: f.num(acts.length) })}</div></div>
              </Card>
            </Grid>

            <Section title={t('m04.plan.gapTitle')} description={t('m04.plan.gapIntro')}>
              {gaps.length === 0 ? <Callout tone="ok" title={t('m04.plan.noGap')}>{t('m04.plan.noGapBody')}</Callout> : (
                <DataTable rows={gaps} rowKey={(r) => r.id} searchable={false} csvName="skills-gap" columns={[
                  { key: 'comp', header: t('m04.plan.competency'), value: (r) => { const c = comp(r.competency_id); return c ? `${c.code} · ${pick(c, 'name')}` : r.competency_id; } },
                  { key: 'imp', header: t('m04.plan.importance'), value: (r) => r.importance, render: (r) => <Chip tone={r.importance === 'core' ? 'accent' : 'neutral'}>{t(`m04.plan.imp.${r.importance}`)}</Chip> },
                  { key: 'have', header: t('m04.plan.currentLevel'), value: (r) => r.have, align: 'end' },
                  { key: 'need', header: t('m04.plan.requiredLevel'), value: (r) => r.required_level, align: 'end' },
                  { key: 'gap', header: t('m04.plan.gap'), value: (r) => r.gap, render: (r) => <span className="num font-semibold text-bad">+{f.num(r.gap)}</span>, align: 'end', sortable: true },
                ]} />
              )}
              <Callout title={t('m04.plan.notAuthorityTitle')}>{t('m04.plan.notAuthority')}</Callout>
            </Section>

            {suggestions.length > 0 && editable && (
              <Section title={t('m04.plan.suggestTitle')} description={t('m04.plan.suggestIntro')}>
                <Grid cols={4}>
                  {suggestions.map(({ course: c, reasons }) => (
                    <Card key={c.id} eyebrow={<span className="ltr">{c.code}</span>} title={<L to={`/learn/course/${c.id}`}>{pick(c, 'title')}</L>}>
                      <div className="mb-2 flex flex-wrap gap-1" data-testid="m04-plan-suggestion" data-course={c.id}><Chip>{lab.modality(c.modality)}</Chip></div>
                      <div className="flex flex-wrap items-center gap-1">
                        <button className="btn-outline btn-sm" onClick={() => setAdding({ kind: 'course', title_en: c.title_en, title_ar: c.title_ar, course_id: c.id })}><Icon name="plus" size={14} />{t('m04.plan.addToPlan')}</button>
                        <WhyThis reasons={reasons} testId="m04-plan-why" />
                      </div>
                    </Card>
                  ))}
                </Grid>
              </Section>
            )}

            <Section title={t('m04.plan.activities')} actions={<div className="flex flex-wrap gap-2">
              <AddToCalendar events={upcomingOnly(acts.filter((a) => a.status !== 'done').map((a) => cal.planActivity(a, '/my/plan', role ? pick(role, 'title') : undefined)).filter((e) => e !== null))} file="my-plan-due-dates" calendarName={t('common.ics.cal.myPlan')} label={t('common.ics.addDue')} testId="m04-plan-ics" />
              {editable && <button className="btn-primary btn-sm" onClick={() => setAdding({ kind: 'ojt', title_en: '', title_ar: '', course_id: null })} data-testid="m04-plan-add"><Icon name="plus" size={14} />{t('m04.plan.addActivity')}</button>}
            </div>}>
              <DataTable rows={acts} rowKey={(r) => r.id} searchable={false} csvName="development-plan" empty={t('m04.plan.noActivities')} initialSort={{ key: 'due', dir: 'asc' }} columns={[
                { key: 'kind', header: t('m04.common.kind'), value: (r) => lab.activity(r.kind) },
                { key: 'title', header: t('m04.common.title'), value: (r) => pick(r, 'title'), render: (r) => r.course_id ? <L to={`/learn/course/${r.course_id}`}>{pick(r, 'title')}</L> : pick(r, 'title') },
                { key: 'due', header: t('m04.common.due'), value: (r) => r.due_on ?? '', render: (r) => f.date(r.due_on), sortable: true },
                { key: 'status', header: t('m04.common.status'), value: (r) => r.status, render: (r) => <G2Pill status={r.status === 'planned' ? 'not_started' : r.status === 'done' ? 'completed' : r.status} /> },
                { key: 'act', header: '', csv: false, render: (r) => editable && r.status !== 'done' ? (
                  <div className="flex justify-end gap-1">
                    {r.status === 'planned' && <button className="btn-ghost btn-sm" onClick={() => setStatus(r, 'in_progress')}>{t('m04.plan.start')}</button>}
                    <button className="btn-outline btn-sm" onClick={() => setStatus(r, 'done')}>{t('m04.plan.markDone')}</button>
                  </div>
                ) : null },
              ]} />
            </Section>

            {adding && <ActivityModal plan={plan} initial={adding} onClose={() => setAdding(null)} />}
            <ConfirmDialog open={submit} onClose={() => setSubmit(false)} title={t('m04.plan.submitTitle')} consequence={t('m04.plan.submitBody')}
              onConfirm={async () => { await run(() => repo.update('dev_plans', plan.id, { status: 'submitted' }), { success: t('m04.plan.submitted') }); }} />
          </div>
        );
      }}
    </Async>
  );
}

function ActivityModal({ plan, initial, onClose }: { plan: DevPlansRow; initial: { kind: string; title_en: string; title_ar: string; course_id: string | null }; onClose: () => void }) {
  const t = useT();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ kind: initial.kind, title_en: initial.title_en, title_ar: initial.title_ar, due: '' }, { kind: [required()], title_en: [required(), maxLen(160)], title_ar: [required(), maxLen(160)], due: [required()] });
  return (
    <Modal open onClose={onClose} title={t('m04.plan.addActivity')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m04-act-form" disabled={form.submitting}>{t('common.save')}</button></>}>
      <form id="m04-act-form" className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (v) => {
        const r = await run(() => repo.insert('plan_activities', { plan_id: plan.id, person_id: plan.person_id, kind: v.kind as PlanActivitiesRow['kind'], title_en: v.title_en.trim(), title_ar: v.title_ar.trim(), due_on: v.due, status: 'planned', course_id: initial.course_id }), { success: t('m04.plan.activitySaved') });
        if (r.ok) onClose();
      })}>
        <SelectField label={t('m04.common.kind')} required options={KINDS.map((k) => ({ value: k, label: lab.activity(k) }))} {...form.field('kind')} />
        <TextField label={t('m04.common.due')} type="date" required {...form.field('due')} />
        <TextField label={t('m04.plan.titleEn')} required {...form.field('title_en')} />
        <TextField label={t('m04.plan.titleAr')} required {...form.field('title_ar')} />
      </form>
    </Modal>
  );
}

function TeamPlans() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const people = usePeople();
  const q = useQuery(['dev_plans', 'plan_activities', 'job_roles'], async () => {
    const [plans, acts, roles] = await Promise.all([repo.list('dev_plans', { filter: { status: 'submitted' } }), repo.list('plan_activities'), repo.list('job_roles')]);
    return { plans: plans.filter((p) => p.person_id !== s.identity.personId), acts, roles };
  }, [s.identity.personId]);
  const [act, setAct] = useState<{ id: string; decision: 'approve' | 'return' } | null>(null);
  const visible = useMemo(() => new Set(people.list.map((p) => p.id)), [people.list]);
  return (
    <Section title={t('m04.plan.teamTitle')} description={t('m04.plan.teamIntro')}>
      <Async state={q}>
        {(d) => {
          const rows = d.plans.filter((p) => visible.has(p.person_id));
          if (people.loading) return <Skeleton />;
          if (!rows.length) return <EmptyState icon="users" title={t('m04.plan.teamNone')} />;
          return (
            <div className="space-y-3" data-testid="m04-team-plans">
              {rows.map((p) => {
                const acts = d.acts.filter((a) => a.plan_id === p.id);
                const role = d.roles.find((r) => r.id === p.target_role_id);
                return (
                  <Card key={p.id} title={`${people.name(p.person_id)} → ${role ? pick(role, 'title') : p.target_role_id}`} eyebrow={t('m04.plan.submittedOn', { date: f.date(p.created_at) })}
                    actions={<div className="flex gap-1"><button className="btn-primary btn-sm" onClick={() => setAct({ id: p.id, decision: 'approve' })} data-testid="m04-plan-approve">{t('m04.common.approve')}</button><button className="btn-outline btn-sm" onClick={() => setAct({ id: p.id, decision: 'return' })}>{t('m04.plan.return')}</button></div>}>
                    <ul className="list-disc space-y-0.5 ps-5 text-[13.5px] text-ink-2">{acts.map((a) => <li key={a.id}>{pick(a, 'title')} · {f.date(a.due_on)}</li>)}</ul>
                  </Card>
                );
              })}
            </div>
          );
        }}
      </Async>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} title={act?.decision === 'approve' ? t('m04.plan.approveTitle') : t('m04.plan.returnTitle')} consequence={act?.decision === 'approve' ? t('m04.plan.approveBody') : t('m04.plan.returnBody')}
        requireReason={act?.decision === 'return'} actingAs={t('m04.common.roleManager')} onConfirm={async (reason) => { if (act) await run(() => repo.rpc.decideDevPlan(act.id, act.decision, reason)); }} />
    </Section>
  );
}

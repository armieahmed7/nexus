// /training/cohorts (M04): cohort views (crew, team, role) with the mandatory-curriculum completion matrix, curriculum gaps after
// role changes (one sync cycle) and external course requests with approval. People are synthetic; this is an internal staff view.
// MGR-05: a second tab, "To book" (?tab=book), lists assigned training that has no seat yet (ToBookPanel.tsx).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Grid, Card, StatTile, Heatmap, ProgressBar, DataTable, ConfirmDialog, Callout, Async, Icon, Skeleton, Tabs } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { G2Pill, useCatalogue, usePeople, daysUntil } from './ui';
import { TeamApprovals } from './TeamApprovals';
import { ToBookPanel, useToBook } from './ToBookPanel';

type By = 'crew' | 'team' | 'role';

export default function TrainingCohortsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const cat = useCatalogue();
  const people = usePeople();
  const [by, setBy] = useState<By>('crew');
  const [value, setValue] = useState('B');
  const [sync, setSync] = useState<string | 'all' | null>(null);
  const q = useQuery(['enrolments', 'curriculum_rules', 'training_records', 'job_roles'], async () => {
    const [enrolments, rules, records, roles] = await Promise.all([repo.list('enrolments'), repo.list('curriculum_rules', { filter: { mandatory: true } }), repo.list('training_records'), repo.list('job_roles')]);
    return { enrolments, rules, records, roles };
  }, []);
  const staff = useMemo(() => people.list.filter((p) => p.kind === 'staff' && p.status === 'active'), [people.list]);
  const options = useMemo(() => {
    const vals = by === 'crew' ? staff.map((p) => p.crew) : by === 'team' ? staff.map((p) => p.team_id) : staff.map((p) => p.job_role_id);
    return [...new Set(vals.filter(Boolean) as string[])].sort();
  }, [by, staff]);
  const canSync = s.can('training', ['W', 'A']);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'book' ? 'book' : 'cohorts';
  const setTab = (id: string) => {
    const p = new URLSearchParams(params);
    if (id === 'book') p.set('tab', 'book');
    else p.delete('tab');
    setParams(p, { replace: true });
  };
  const toBook = useToBook(cat, people);

  const cohorts = (
    <Async state={q}>
      {(d) => {
        if (people.loading) return <Skeleton lines={6} />;
        const roleTitle = (id: string | null | undefined) => pick(d.roles.find((r) => r.id === id), 'title') || id || '—';
        const members = staff.filter((p) => (by === 'crew' ? p.crew : by === 'team' ? p.team_id : p.job_role_id) === value);
        const required = (roleId: string | null | undefined) => d.rules.filter((r) => r.role_id === roleId).map((r) => r.course_id);
        const cols = [...new Set(members.flatMap((m) => required(m.job_role_id)))].sort((a, b) => (cat.course.get(a)?.code ?? a).localeCompare(cat.course.get(b)?.code ?? b));
        const state = (pid: string, cid: string) => {
          const e = d.enrolments.filter((x) => x.person_id === pid && x.course_id === cid && x.status !== 'cancelled').sort((a, b) => String(b.enrolled_at).localeCompare(String(a.enrolled_at)))[0];
          const rec = d.records.find((r) => r.person_id === pid && r.course_id === cid && r.result !== 'failed');
          if (e?.status === 'completed' || rec) return 'completed';
          if (!e) return 'missing';
          if ((daysUntil(e.due_on) ?? 1) < 0) return 'overdue';
          return e.status;
        };
        const cells = members.flatMap((m) => required(m.job_role_id).map((c) => state(m.id, c)));
        const done = cells.filter((x) => x === 'completed').length;
        const overdue = cells.filter((x) => x === 'overdue').length;
        const missing = members.map((m) => ({ m, n: required(m.job_role_id).filter((c) => state(m.id, c) === 'missing').length })).filter((x) => x.n > 0);
        const allGaps = staff.map((m) => ({ m, n: required(m.job_role_id).filter((c) => state(m.id, c) === 'missing').length })).filter((x) => x.n > 0);
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1"><span className="caps">{t('m04.cohort.by')}</span>
                <select className="input min-w-[160px]" value={by} onChange={(e) => { const b = e.target.value as By; setBy(b); setValue(''); }} data-testid="m04-cohort-by">
                  <option value="crew">{t('m04.cohort.byCrew')}</option><option value="team">{t('m04.cohort.byTeam')}</option><option value="role">{t('m04.cohort.byRole')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="caps">{t('m04.cohort.cohort')}</span>
                <select className="input min-w-[220px]" value={value} onChange={(e) => setValue(e.target.value)} data-testid="m04-cohort-value">
                  <option value="">{t('common.choose')}</option>
                  {options.map((o) => <option key={o} value={o}>{by === 'role' ? roleTitle(o) : by === 'crew' ? `${t('m04.common.crew')} ${o}` : o}</option>)}
                </select>
              </label>
            </div>
            {!value || members.length === 0 ? <Callout title={t('m04.cohort.pick')}>{t('m04.cohort.pickBody')}</Callout> : (
              <>
                <Grid cols={4}>
                  <StatTile label={t('m04.cohort.members')} value={f.num(members.length)} />
                  <StatTile label={t('m04.cohort.completion')} value={f.pct(cells.length ? (done * 100) / cells.length : 0, 0)} sub={t('m04.cohort.completionSub', { done: f.num(done), total: f.num(cells.length) })} tone="ok" />
                  <StatTile label={t('m04.cohort.overdue')} value={f.num(overdue)} tone={overdue ? 'bad' : undefined} />
                  <StatTile label={t('m04.cohort.gaps')} value={f.num(missing.reduce((n, x) => n + x.n, 0))} tone={missing.length ? 'sim' : undefined} sub={t('m04.cohort.gapsSub')} />
                </Grid>
                <Card title={t('m04.cohort.matrix')}>
                  <div className="overflow-x-auto" data-testid="m04-cohort-matrix">
                    <Heatmap title={t('m04.cohort.matrix')} rows={members.map((m) => m.id)} cols={cols} rowLabel={(r) => people.name(r)} colLabel={(c) => cat.course.get(c)?.code ?? c}
                      value={(r, c) => {
                        const req = required(members.find((m) => m.id === r)?.job_role_id).includes(c);
                        if (!req) return { v: null, label: '·', tone: 'neutral' };
                        const st = state(r, c);
                        return { v: 1, label: t(`m04.cohort.cell.${st}`), tone: st === 'completed' ? 'ok' : st === 'overdue' ? 'bad' : st === 'missing' ? 'sim' : st === 'in_progress' || st === 'enrolled' ? 'info' : 'neutral' };
                      }} />
                  </div>
                  <p className="mt-2 text-[12.5px] text-ink-3">{t('m04.cohort.matrixNote')}</p>
                </Card>
                <Card title={t('m04.cohort.byCourse')}>
                  <ul className="space-y-2">
                    {cols.map((c) => {
                      const need = members.filter((m) => required(m.job_role_id).includes(c));
                      const ok = need.filter((m) => state(m.id, c) === 'completed').length;
                      return <li key={c} className="grid grid-cols-[minmax(120px,240px)_1fr_auto] items-center gap-3 text-[13px]"><span className="truncate">{cat.course.get(c)?.code ?? c} · {pick(cat.course.get(c), 'title')}</span><ProgressBar value={need.length ? (ok * 100) / need.length : 0} tone={ok === need.length ? 'ok' : 'accent'} label={pick(cat.course.get(c), 'title')} /><span className="num text-ink-2">{f.num(ok)}/{f.num(need.length)}</span></li>;
                    })}
                  </ul>
                </Card>
              </>
            )}

            <Section title={t('m04.cohort.syncTitle')} description={t('m04.cohort.syncIntro')} actions={canSync ? <button className="btn-primary btn-sm" onClick={() => setSync('all')} data-testid="m04-cohort-sync"><Icon name="reset" size={14} />{t('m04.builder.runSync')}</button> : null}>
              <DataTable rows={allGaps} rowKey={(r) => r.m.id} searchable csvName="curriculum-gaps" empty={t('m04.cohort.noGaps')} pageSize={10} columns={[
                { key: 'name', header: t('m04.cohort.person'), value: (r) => people.name(r.m.id), sortable: true },
                { key: 'role', header: t('m04.cohort.role'), value: (r) => roleTitle(r.m.job_role_id), sortable: true },
                { key: 'crew', header: t('m04.common.crew'), value: (r) => r.m.crew ?? '—' },
                { key: 'n', header: t('m04.cohort.missingCourses'), value: (r) => r.n, align: 'end', sortable: true },
                { key: 'act', header: '', csv: false, render: (r) => canSync ? <button className="btn-outline btn-sm" onClick={() => setSync(r.m.id)}>{t('m04.cohort.assign')}</button> : null },
              ]} />
            </Section>

            {s.can('training', ['A']) && <Section title={t('m04.cohort.approvals')}><TeamApprovals /></Section>}
            <ConfirmDialog open={!!sync} onClose={() => setSync(null)} title={t('m04.builder.syncTitle')} consequence={sync === 'all' ? t('m04.builder.syncBody') : t('m04.cohort.syncOne', { name: sync ? people.name(sync) : '' })} actingAs={t('m04.common.roleTraining')}
              onConfirm={async () => { if (sync) await run(() => repo.rpc.curriculumSync(sync === 'all' ? null : sync)); }} />
            <p className="text-[12.5px] text-ink-3"><G2Pill status="synthetic" tone="sim" /> {t('m04.cohort.synthetic')}</p>
          </div>
        );
      }}
    </Async>
  );
  return (
    <Page title={t('m04.routes.training-cohorts.title')} intro={t('m04.cohort.intro')} wide>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'cohorts', label: t('m04.toBook.tabCohorts'), content: cohorts },
        { id: 'book', label: t('m04.toBook.tab'), badge: toBook.items ? f.num(toBook.items.length) : undefined, content: <ToBookPanel data={toBook} /> },
      ]} />
    </Page>
  );
}

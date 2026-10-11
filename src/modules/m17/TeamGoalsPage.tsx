// FS33 /team/skills/goals: the skill goals people in my scope chose to share with me (opt-in). The repository applies RLS:
// a goal is readable by a manager only while it is active and shared by its person (share_person), never by HR, the training
// manager's A grant or peers. Private goals are not counted or hinted at anywhere on this page.
import { useMemo, useState } from 'react';
import { Page, Async, BenchmarkChips, Callout, Card, DataTable, EmptyState, Grid, StatTile, WhyThis, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { GoalPill, todayIso } from './goalsUi';
import { goalView, sortGoals, type GoalView } from './skillGoals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Line = GoalView & { person: Row | null; skill: Row | null; note: string | null };

export default function TeamGoalsPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['skill_goal_plans', 'person_skills', 'people', 'skills'], async () => {
    const plans = await repo.list('skill_goal_plans');
    const ids = [...new Set(plans.map((p: Row) => p.person_id))];
    const [people, skills, states] = await Promise.all([
      repo.list('people', { filter: { kind: 'staff' } }), repo.list('skills'),
      ids.length ? repo.list('person_skills', { filter: { person_id: ids } }) : Promise.resolve([] as Row[]),
    ]);
    const today = todayIso();
    const sk = new Map(skills.map((s: Row) => [s.id, s]));
    const lines: Line[] = sortGoals(plans.filter((p: Row) => p.status === 'active' && p.shared).map((p: Row) => {
      const s = sk.get(p.skill_id);
      const st = states.find((x: Row) => x.person_id === p.person_id && x.skill_id === p.skill_id && x.active !== false);
      return goalView(p, st, today, s ? { en: s.name_en, ar: s.name_ar } : undefined);
    })).map((v) => { const p = plans.find((x: Row) => x.id === v.id); return { ...v, person: people.find((x: Row) => x.id === p?.person_id) ?? null, skill: sk.get(v.skill_id) ?? null, note: p?.note ?? null }; });
    return { lines };
  }, []);
  return (
    <Page title={t('m17.routes.team-skills-goals.title')} eyebrow={<BenchmarkChips feature="FS33" />} intro={t('m17.sg.team.intro')} wide
      actions={<L to="/team/skills" className="btn-ghost btn-sm no-underline">{t('m17.tm.toHeatmap')}</L>}>
      <Callout tone="info" title={t('m17.sg.team.optInTitle')}>{t('m17.sg.team.optInBody')}</Callout>
      <Async state={q}>{(d) => <Team lines={d.lines} />}</Async>
    </Page>
  );
}

function Team({ lines }: { lines: Line[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [who, setWho] = useState<string>('all');
  const people = useMemo(() => [...new Map(lines.filter((l) => l.person).map((l) => [l.person.id, l.person])).values()].sort((a, b) => String(a.display_name).localeCompare(String(b.display_name))), [lines]);
  const rows = who === 'all' ? lines : lines.filter((l) => l.person?.id === who);
  if (!lines.length) return <EmptyState title={t('m17.sg.team.empty')}>{t('m17.sg.team.emptyBody')}</EmptyState>;
  const cols: Column<Line>[] = [
    { key: 'person', header: t('m17.sg.team.col.person'), value: (l) => l.person?.display_name ?? '', sortable: true, render: (l) => l.person ? <L to={`/team/passport/${l.person.id}`} className="font-semibold">{pick(l.person, 'display_name')}</L> : '—' },
    { key: 'skill', header: t('m17.sg.team.col.skill'), value: (l) => l.skill?.code ?? l.skill_id, sortable: true, render: (l) => <span>{l.skill ? pick(l.skill, 'name') : l.skill_id} <span className="num text-[11.5px] text-ink-3">{l.skill?.code}</span></span> },
    { key: 'level', header: t('m17.sg.team.col.level'), value: (l) => l.gap, sortable: true, render: (l) => t('m17.sg.climb', { level: f.num(l.level), target: f.num(l.target_level) }) },
    { key: 'date', header: t('m17.sg.team.col.date'), value: (l) => l.target_date ?? '', sortable: true, render: (l) => (l.target_date ? f.date(l.target_date) : '—') },
    { key: 'status', header: t('m17.sg.team.col.status'), value: (l) => l.status, render: (l) => <GoalPill status={l.status} /> },
    { key: 'why', header: '', value: () => '', render: (l) => <WhyThis reasons={l.reasons} testId="m17-sg-team-why" /> },
  ];
  return (
    <div className="space-y-5">
      <Grid cols={3}>
        <StatTile label={t('m17.sg.team.tile.people')} value={f.num(people.length)} sub={t('m17.sg.team.tile.peopleSub')} />
        <StatTile label={t('m17.sg.team.tile.goals')} value={f.num(lines.length)} sub={t('m17.sg.team.tile.goalsSub')} tone="info" />
        <StatTile label={t('m17.sg.team.tile.soon')} value={f.num(lines.filter((l) => l.status === 'due_soon' || l.status === 'overdue').length)} sub={t('m17.sg.team.tile.soonSub')} tone="sim" />
      </Grid>
      <Card title={t('m17.sg.team.listTitle')} actions={
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('m17.sg.team.col.person')}>
          {[{ id: 'all', display_name: t('m17.sg.team.everyone') }, ...people].map((p) => <button key={p.id} type="button" aria-pressed={who === p.id} className={`chip ${who === p.id ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink-2'}`} onClick={() => setWho(p.id)}>{p.id === 'all' ? p.display_name : pick(p, 'display_name')}</button>)}
        </div>}>
        <div data-testid="m17-sg-team"><DataTable rows={rows} columns={cols} rowKey={(l) => l.id} csvName="team-shared-skill-goals.csv" searchable={false} /></div>
        <p className="mt-2 text-[12px] text-ink-3">{t('m17.sg.team.note')}</p>
      </Card>
    </div>
  );
}

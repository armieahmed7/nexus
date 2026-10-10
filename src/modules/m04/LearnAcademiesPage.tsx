// FS20 /learn/academies (public): the four future-skills academies on one template (modules + project + mentor, with a separate
// reviewer for the capstone; the Nordic trainee-programme pattern), their cohorts on a calendar, and cohort statistics that are
// suppressed when they describe fewer than 10 people. Signed-in staff can go on to nominate from an academy page.
import { Page, Section, Card, Async, Callout, BenchmarkChips, Icon, Timeline, StatTile } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { CohortPill, NoDecisionNote, Simulated, SkillChip, Suppressible, TemplateTriad, cohortStatsOf, useAcademyData, type AcademyData } from './fsUi';

export default function LearnAcademiesPage() {
  const t = useT();
  const q = useAcademyData();
  return (
    <Page title={t('m04.routes.learn-academies.title')} intro={t('m04.acad.intro')} wide eyebrow={<BenchmarkChips feature="FS20" />}>
      <Async state={q}>{(d) => <Academies d={d} />}</Async>
    </Page>
  );
}

function Academies({ d }: { d: AcademyData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const totals = d.stats.academies;
  const people = totals.reduce((n, a) => n + (a.participants ?? 0), 0);
  const anySuppressed = totals.some((a) => a.participants == null);
  return (
    <div className="space-y-6">
      <Section title={t('m04.acad.template.title')} description={t('m04.acad.template.intro')}>
        <TemplateTriad />
      </Section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('m04.acad.tile.academies')} value={f.num(d.academies.length)} />
        <StatTile label={t('m04.acad.tile.cohorts')} value={f.num(d.cohorts.length)} sub={t('m04.acad.tile.cohortsSub', { n: f.num(d.cohorts.filter((c) => c.status === 'nominating').length) })} />
        <StatTile label={t('m04.acad.tile.participants')} value={f.num(people)} sub={anySuppressed ? t('m04.acad.tile.partSub') : undefined} tone="info" />
        <StatTile label={t('m04.acad.tile.modules')} value={f.num(new Set(d.academies.flatMap((a) => a.module_course_ids)).size)} sub={t('m04.acad.tile.modulesSub')} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m04-acad-list">
        {d.academies.map((a) => {
          const cohorts = d.cohorts.filter((c) => c.academy_id === a.id);
          const next = cohorts.find((c) => c.status === 'nominating') ?? cohorts.find((c) => c.status === 'running') ?? cohorts[cohorts.length - 1];
          const st = totals.find((x) => x.academy_id === a.id);
          const hours = a.module_course_ids.reduce((n: number, id: string) => n + Number(d.courses.get(id)?.duration_hours ?? 0), 0);
          return (
            <Card key={a.id} eyebrow={<span className="flex flex-wrap items-center gap-1.5"><bdi dir="ltr" className="num">{a.code}</bdi><Simulated /></span>}
              title={<L to={`/learn/academies/${a.id}`} className="no-underline" data-testid="m04-acad-card">{pick(a, 'name')}</L>}
              footer={<L to={`/learn/academies/${a.id}`} className="btn-outline btn-sm inline-flex no-underline">{t('m04.acad.open')}<Icon name="chevron" size={13} className="rtl:-scale-x-100" /></L>}>
              <p className="text-[13.5px] text-ink-2">{pick(a, 'tagline')}</p>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
                <div><dt className="caps text-[10.5px]">{t('m04.acad.triad.modules')}</dt><dd>{t('m04.acad.modulesN', { n: f.num(a.module_course_ids.length), h: f.num(hours) })}</dd></div>
                <div className="sm:col-span-2"><dt className="caps text-[10.5px]">{t('m04.acad.triad.project')}</dt><dd className="line-clamp-2">{pick(a, 'project')}</dd></div>
                <div className="sm:col-span-3"><dt className="caps text-[10.5px]">{t('m04.acad.triad.mentor')}</dt><dd>{pick(a, 'mentor_role')}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">{(a.capstone_skills ?? []).map((s: { skill_id: string; level: number }) => <SkillChip key={s.skill_id} skill={d.skills.get(s.skill_id)} level={s.level} />)}</div>
              {next && <p className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]"><CohortPill status={next.status} /><span>{pick(next, 'label')}</span><span className="text-ink-3">{f.date(next.starts_on)} – {f.date(next.ends_on)}</span></p>}
              <p className="mt-2 text-[12.5px] text-ink-3">{t('m04.acad.participants')}: <Suppressible value={st?.participants} /> · {t('m04.acad.alumni')}: <Suppressible value={st?.alumni} /></p>
              {a.no_decision && <div className="mt-2"><NoDecisionNote /></div>}
            </Card>
          );
        })}
      </div>

      <Section title={t('m04.acad.calendar.title')} description={t('m04.acad.calendar.intro')}>
        <div className="card p-4" data-testid="m04-acad-calendar">
          <Timeline items={d.cohorts.map((c) => {
            const a = d.academies.find((x) => x.id === c.academy_id);
            const s = cohortStatsOf(d.stats, c.id);
            return {
              id: c.id, when: `${f.date(c.starts_on)} – ${f.date(c.ends_on)}`, tone: c.status === 'running' ? 'ok' : c.status === 'nominating' ? 'info' : 'neutral',
              title: <span className="flex flex-wrap items-center gap-2">{pick(a, 'name')} · {pick(c, 'label')} <CohortPill status={c.status} /></span>,
              detail: <span>{t('m04.acad.participants')}: <Suppressible value={s?.participants} />{c.status === 'nominating' && c.nominations_close_on ? ` · ${t('m04.acad.closes', { date: f.date(c.nominations_close_on) })}` : ''}</span>,
            };
          })} />
        </div>
      </Section>
      <Callout tone="info" title={t('m04.acad.suppress.title')}>{t('m04.acad.suppress.body')}</Callout>
    </div>
  );
}

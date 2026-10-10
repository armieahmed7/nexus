// FS19 panel on /learn/course/:id for a future-skills pack course: the skills its objectives teach at a stated level (each also the
// course's F01 evidence key), the hour envelope, theme, cross-over details, the copy and link check, SIMULATED outline label and
// sources with their as-of date. Renders nothing for other courses.
import { BenchmarkChips, Card, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, usePick, useT } from '../../i18n';
import { AsOfSources, LevelDots, NoDecisionNote, Simulated, SkillChip, ThemeChip, useEnvelope, type Row } from './fsUi';

export function FsCoursePanel({ courseId }: { courseId: string }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const env = useEnvelope();
  const q = useQuery(['course_pack_items', 'course_skill_links', 'courses', 'skills'], async () => {
    const [items, links] = await Promise.all([
      repo.list('course_pack_items', { filter: { course_id: courseId } }),
      repo.list('course_skill_links', { filter: { course_id: courseId, active: true }, order: [['objective_n', 'asc']] }),
    ]);
    const item = items[0] as Row | undefined;
    if (!item) return null;
    const [course, skills, origin] = await Promise.all([
      repo.get('courses', courseId), repo.list('skills'), item.crossover_of ? repo.get('courses', item.crossover_of) : Promise.resolve(null),
    ]);
    return { item, links: links as Row[], course: course as Row | null, skills: new Map(skills.map((s) => [s.id, s as Row])), origin: origin as Row | null };
  }, [courseId]);
  const d = q.data;
  if (!d || !d.course) return null;
  return (
    <Card title={<span className="flex flex-wrap items-center gap-2">{t('m04.fsc.panel.title')}<ThemeChip theme={d.item.theme} /><Simulated /></span>}
      eyebrow={<BenchmarkChips feature="FS19" />} actions={<L to="/learn/future-skills" className="btn-ghost btn-sm">{t('m04.fsc.panel.all')}</L>}>
      <div className="space-y-3" data-testid="m04-fs-panel">
        <p className="flex items-center gap-1.5 text-[13px] text-ink-2"><Icon name="calendar" size={13} />{env(Number(d.course.duration_hours), d.item.weeks, Number(d.item.weekly_hours))}</p>
        <ul className="space-y-2">
          {d.links.map((l) => (
            <li key={l.id} className="flex flex-col gap-1 rounded-md bg-sunken p-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[13px]">{pick(l, 'objective')}</span>
              <span className="flex items-center gap-2"><SkillChip skill={d.skills.get(l.skill_id)} /><LevelDots level={Number(l.level)} /></span>
            </li>
          ))}
        </ul>
        <p className="text-[12.5px] text-ink-3">{t('m04.fsc.panel.evidence')}</p>
        {d.item.kind === 'crossover' && (
          <p className="text-[13px]">{t('m04.fsc.panel.crossover')} {(d.item.for_industries ?? []).map((x: string) => t(`m04.fsc.industry.${x}`)).join(t('m04.fsc.panel.sep'))}.
            {d.origin && <> {t('m04.fsc.cross.of')} <L to={`/learn/course/${d.origin.id}`}>{pick(d.origin, 'title')}</L></>}</p>
        )}
        {d.item.no_decision && <NoDecisionNote />}
        <p className={`flex items-center gap-1.5 text-[12.5px] ${d.item.copy_check === 'passed' ? 'text-ok' : 'text-bad'}`} data-testid="m04-fs-panel-check" data-result={d.item.copy_check}>
          <Icon name="shield" size={13} />{t(`m04.fsc.panel.check.${d.item.copy_check}`)}
        </p>
        <AsOfSources items={d.course.sources} />
      </div>
    </Card>
  );
}

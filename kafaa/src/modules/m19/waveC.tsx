// FS wave C integration (QA lead): "close the gap" links between the wave-C features, reading rows only (no RPC, no import of
// another module's rules). Shows, for a set of catalogue skills, the FS19 pack courses that teach them (kafaa_course_skill_links,
// public) and the FS17 learning pathways that build them (kafaa_pathways, published rows for staff; anon and partners see none).
// Used by the FS25 core-skill page (m33) and the FS21 adaptive result (m05).
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Card, Icon } from '../../ui';

type Row = Record<string, any>;

export function useLearnForSkills(skillIds: string[]) {
  const repo = useRepo();
  const key = [...new Set(skillIds)].sort().join(',');
  return useQuery(['course_skill_links', 'courses', 'pathways', 'course_pack_items'], async () => {
    const ids = new Set(key ? key.split(',') : []);
    const [links, pack, courses, pathways] = await Promise.all([
      repo.list('course_skill_links' as never) as Promise<Row[]>,
      repo.list('course_pack_items' as never) as Promise<Row[]>,
      repo.list('courses' as never) as Promise<Row[]>,
      (repo.list('pathways' as never, { filter: { status: 'published' } } as never) as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    const packIds = new Set(pack.map((p) => p.course_id));
    const byCourse = new Map<string, Row[]>();
    for (const l of links) if (l.active !== false && ids.has(l.skill_id) && packIds.has(l.course_id)) byCourse.set(l.course_id, [...(byCourse.get(l.course_id) ?? []), l]);
    const cs = courses.filter((c) => byCourse.has(c.id) && ['staff', 'public'].includes(String(c.audience))).sort((a, b) => (a.id < b.id ? -1 : 1));
    const pws = pathways.filter((p) => p.status === 'published' && ids.has(p.skill_id)).sort((a, b) => Number(a.level) - Number(b.level) || (a.id < b.id ? -1 : 1));
    return { courses: cs.map((c) => ({ c, levels: [...new Set((byCourse.get(c.id) ?? []).map((l) => Number(l.level)))].sort() })), pathways: pws };
  }, [key]);
}

/** FS17 + FS19 for a set of skills, as one card. Renders nothing while loading or when there is nothing to show. */
export function LearnForSkills({ skillIds, title, testId = 'wc-learn' }: { skillIds: string[]; title?: string; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const q = useLearnForSkills(skillIds);
  const d = q.data;
  if (!d || (!d.courses.length && !d.pathways.length)) return null;
  return (
    <Card title={title ?? t('m19.wc.title')} eyebrow={t('m19.wc.eyebrow')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid={testId}>
        <div>
          <h3 className="caps mb-1.5">{t('m19.wc.courses')}</h3>
          {d.courses.length ? (
            <ul className="space-y-1.5 text-[13px]" data-testid={`${testId}-courses`}>
              {d.courses.map(({ c, levels }) => (
                <li key={c.id} className="flex flex-wrap items-center gap-1.5"><Icon name="book" size={13} className="text-ink-3" /><L to={`/learn/course/${c.id}`}>{pick(c, 'title')}</L>
                  <span className="text-[11.5px] text-ink-3">{t('m19.wc.levels', { levels: levels.map((n) => f.num(n)).join(', ') })}</span></li>
              ))}
            </ul>
          ) : <p className="text-[12.5px] text-ink-3">{t('m19.wc.noCourses')}</p>}
          <L to="/learn/future-skills" className="mt-2 inline-block text-[12.5px]">{t('m19.wc.allCourses')}</L>
        </div>
        <div>
          <h3 className="caps mb-1.5">{t('m19.wc.pathways')}</h3>
          {d.pathways.length ? (
            <ul className="space-y-1.5 text-[13px]" data-testid={`${testId}-pathways`}>
              {d.pathways.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-1.5"><Icon name="calendar" size={13} className="text-ink-3" /><L to={`/learn/pathways/${p.id}`}>{pick(p, 'title')}</L>
                  <span className="text-[11.5px] text-ink-3">{t('m19.wc.envelope', { months: f.num(Number(p.envelope_months)), hours: f.num(Number(p.weekly_hours)) })}</span></li>
              ))}
            </ul>
          ) : <p className="text-[12.5px] text-ink-3">{t('m19.wc.noPathways')}</p>}
          <L to="/learn/pathways" className="mt-2 inline-block text-[12.5px]">{t('m19.wc.allPathways')}</L>
        </div>
      </div>
    </Card>
  );
}

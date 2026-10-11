// FS19 /learn/future-skills (public): the future-skills course pack. About 18 modular courses (60 hours or less) with objectives linked
// to skills at a stated level, an hour envelope, sources with an as-of date and a SIMULATED outline label; cross-over versions for
// adjacent industries; the learning routes the pack opens for skills nobody held. Signed-in staff also see the courses ranked against
// their gaps today and in their role's 2030 profile (FS05), each with "Why this?" reasons, and can enrol.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, BenchmarkChips, Icon, StatTile, ProgressBar, WhyThis, SelectField, EmptyState } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { PACK_THEMES, UNHELD_BASELINE, packForMe, type Requirement, type SkillRef } from './fsPack';
import { AsOfSources, LevelDots, NoDecisionNote, Simulated, SkillChip, ThemeChip, useEnvelope, usePackData, type PackData, type Row } from './fsUi';

export default function LearnFutureSkillsPage() {
  const t = useT();
  const q = usePackData();
  return (
    <Page title={t('m04.routes.learn-future-skills.title')} intro={t('m04.fsc.intro')} wide eyebrow={<BenchmarkChips feature="FS19" />}>
      <Async state={q} isEmpty={(d) => !d.courses.length} empty={<EmptyState icon="book" title={t('m04.fsc.empty')} />}>{(d) => <Pack d={d} />}</Async>
    </Page>
  );
}

function Pack({ d }: { d: PackData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const env = useEnvelope();
  const s = useSession();
  const [theme, setTheme] = useState('');
  const [maxH, setMaxH] = useState('');
  const core = d.items.filter((i) => i.kind === 'core');
  const cross = d.items.filter((i) => i.kind === 'crossover');
  const hours = core.reduce((n, i) => n + Number(d.courseOf.get(i.course_id)?.duration_hours ?? 0), 0);
  const taught = new Set(d.links.map((l) => l.skill_id));
  const shown = core.filter((i) => (!theme || i.theme === theme) && (!maxH || Number(d.courseOf.get(i.course_id)?.duration_hours) <= Number(maxH)));
  const base = UNHELD_BASELINE.map((id) => d.routeOf.get(id)).filter(Boolean);
  const staff = s.status === 'signed_in' && s.can('training', ['Own']) && s.person?.kind === 'staff';
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m04-fsc-tiles">
        <StatTile label={t('m04.fsc.tile.courses')} value={f.num(core.length)} sub={t('m04.fsc.tile.coursesSub', { n: f.num(cross.length) })} />
        <StatTile label={t('m04.fsc.tile.hours')} value={t('m04.common.hours', { n: f.num(hours) })} sub={t('m04.fsc.tile.hoursSub', { max: f.num(60) })} />
        <StatTile label={t('m04.fsc.tile.skills')} value={f.num(taught.size)} sub={t('m04.fsc.tile.skillsSub', { n: f.num(d.coverage.futureCovered), total: f.num(d.coverage.future) })} tone="info" />
        <StatTile label={t('m04.fsc.tile.unheld')} value={t('m04.fsc.tile.unheldValue', { n: f.num(d.coverage.baselineCovered), total: f.num(d.coverage.baseline) })} sub={t('m04.fsc.tile.unheldSub')} tone="ok" />
      </div>

      {staff ? <ForMe d={d} /> : (
        <Callout tone="info" title={t('m04.fsc.forMe.anonTitle')}>
          {t('m04.fsc.forMe.anonBody')} {s.status !== 'signed_in' && <L to="/sign-in" className="font-semibold">{t('m04.fsc.forMe.signIn')}</L>}
        </Callout>
      )}

      <Section title={t('m04.fsc.catalogue.title')} description={t('m04.fsc.catalogue.intro')}
        actions={<div className="flex flex-wrap gap-2">
          <div className="w-48"><SelectField name="m04-fsc-theme" label={t('m04.fsc.filter.theme')} value={theme} onChange={setTheme} placeholder={t('m04.fsc.filter.allThemes')} options={PACK_THEMES.map((x) => ({ value: x, label: t(`m04.fsc.theme.${x}`) }))} /></div>
          <div className="w-40"><SelectField name="m04-fsc-hours" label={t('m04.fsc.filter.hours')} value={maxH} onChange={setMaxH} placeholder={t('m04.fsc.filter.anyHours')} options={[8, 12, 16, 24].map((h) => ({ value: String(h), label: t('m04.fsc.filter.upTo', { n: f.num(h) }) }))} /></div>
        </div>}>
        {shown.length === 0 ? <EmptyState title={t('m04.fsc.filter.none')} /> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m04-fsc-courses">
            {shown.map((i) => <CourseCard key={i.course_id} d={d} item={i} env={env} />)}
          </div>
        )}
      </Section>

      <Section title={t('m04.fsc.cross.title')} description={t('m04.fsc.cross.intro')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m04-fsc-crossover">
          {cross.map((i) => {
            const c = d.courseOf.get(i.course_id)!;
            return (
              <Card key={i.course_id} eyebrow={<span className="flex flex-wrap items-center gap-1.5"><Icon name="globe" size={13} />{t('m04.fsc.cross.eyebrow')}</span>} title={<L to={`/learn/course/${c.id}`} className="no-underline">{pick(c, 'title')}</L>}>
                <p className="text-[13px] text-ink-2">{pick(c, 'summary')}</p>
                <p className="mt-2 text-[12.5px] text-ink-3">{env(Number(c.duration_hours), i.weeks, Number(i.weekly_hours))}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{(i.for_industries ?? []).map((x: string) => <span key={x} className="chip border-line bg-sunken normal-case tracking-normal text-ink-2">{t(`m04.fsc.industry.${x}`)}</span>)}</div>
                {i.crossover_of && <p className="mt-2 text-[12.5px]">{t('m04.fsc.cross.of')} <L to={`/learn/course/${i.crossover_of}`}>{pick(d.courseOf.get(i.crossover_of), 'title')}</L></p>}
                {i.no_decision && <div className="mt-2"><NoDecisionNote /></div>}
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title={t('m04.fsc.routes.title')} description={t('m04.fsc.routes.intro')}>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]" data-testid="m04-fsc-routes">
            <caption className="sr-only">{t('m04.fsc.routes.title')}</caption>
            <thead><tr className="border-b border-line">
              <th scope="col" className="caps px-3 py-2 text-start">{t('m04.fsc.routes.skill')}</th>
              <th scope="col" className="caps px-3 py-2 text-start">{t('m04.fsc.routes.before')}</th>
              <th scope="col" className="caps px-3 py-2 text-start">{t('m04.fsc.routes.courses')}</th>
            </tr></thead>
            <tbody>
              {base.map((r) => (
                <tr key={r!.skill_id} className="border-b border-line/60 align-top" data-skill={r!.skill_id}>
                  <td className="px-3 py-2"><SkillChip skill={d.skills.get(r!.skill_id)} /></td>
                  <td className="px-3 py-2 text-ink-3">{t('m04.fsc.routes.nobody')}</td>
                  <td className="space-y-1 px-3 py-2">{r!.courses.map((c) => <div key={c.course_id} className="flex flex-wrap items-center gap-2"><L to={`/learn/course/${c.course_id}`}>{pick(d.courseOf.get(c.course_id), 'title')}</L><LevelDots level={c.level} /></div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card mt-3 p-4">
          <div className="mb-1 flex items-center justify-between text-[13px]"><span>{t('m04.fsc.routes.futureCover')}</span><span className="num">{f.num(d.coverage.futureCovered)}/{f.num(d.coverage.future)}</span></div>
          <ProgressBar value={d.coverage.future ? (d.coverage.futureCovered * 100) / d.coverage.future : 0} tone="ok" label={t('m04.fsc.routes.futureCover')} />
          <p className="mt-2 text-[12.5px] text-ink-3">{t('m04.fsc.routes.futureNote')}</p>
        </div>
      </Section>

      <Callout tone="sim" title={t('m04.fsc.sim.title')}>{t('m04.fsc.sim.body')}</Callout>
    </div>
  );
}

function CourseCard({ d, item, env }: { d: PackData; item: Row; env: (h: number, w: number, wk: number) => string }) {
  const t = useT();
  const pick = usePick();
  const c = d.courseOf.get(item.course_id);
  if (!c) return null;
  const links = d.linksOf(c.id);
  return (
    <Card eyebrow={<span className="flex flex-wrap items-center gap-1.5"><bdi dir="ltr" className="num">{c.code}</bdi><ThemeChip theme={item.theme} /><Simulated /></span>}
      title={<L to={`/learn/course/${c.id}`} className="no-underline" data-testid="m04-fsc-course">{pick(c, 'title')}</L>}>
      <p className="line-clamp-3 text-[13px] text-ink-2">{pick(c, 'summary')}</p>
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-3"><Icon name="calendar" size={13} />{env(Number(c.duration_hours), item.weeks, Number(item.weekly_hours))}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{links.map((l) => <SkillChip key={l.id} skill={d.skills.get(l.skill_id)} level={Number(l.level)} />)}</div>
      {item.no_decision && <div className="mt-2"><NoDecisionNote /></div>}
      <div className="mt-2"><AsOfSources items={c.sources} /></div>
      {item.copy_check === 'passed' && item.theme === 'cyber' && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ok" data-testid="m04-fsc-copycheck"><Icon name="shield" size={13} />{t('m04.fsc.copyPassed')}</p>}
    </Card>
  );
}

/** My picks: pack courses that close my gaps today and in my role's 2030 profile, with reasons; enrol from here. */
function ForMe({ d }: { d: PackData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const roleId = s.person?.job_role_id ?? null;
  const q = useQuery(['person_skills', 'role_profile_versions', 'enrolments'], async () => {
    const [states, versions, enr] = await Promise.all([
      repo.list('person_skills', { filter: { person_id: me ?? '' } }),
      roleId ? repo.list('role_profile_versions', { filter: { role_id: roleId, status: 'published' } }) : Promise.resolve([]),
      repo.list('enrolments', { filter: { person_id: me ?? '' } }),
    ]);
    return { states, versions, enr };
  }, [me, roleId]);
  const picks = useMemo(() => {
    if (!q.data) return [];
    const lv = new Map(q.data.states.filter((x) => x.active).map((x) => [x.skill_id, Number(x.level)]));
    const reqs: Requirement[] = [];
    for (const v of q.data.versions as Row[]) {
      if (v.horizon !== 'now' && v.horizon !== '2030') continue;
      for (const r of (v.requirements ?? []) as Row[]) reqs.push({ kind: r.kind, ref_id: r.ref_id, level: Number(r.level), horizon: v.horizon });
    }
    const done = new Set(q.data.enr.filter((e) => e.status === 'completed').map((e) => e.course_id));
    const open = new Set(q.data.enr.filter((e) => !['completed', 'cancelled', 'failed'].includes(e.status)).map((e) => e.course_id));
    return packForMe(d.courses as never, d.items as never, d.links as never, reqs, (id) => lv.get(id) ?? 0, d.skills as unknown as Map<string, SkillRef>, d.routeOf, done, open).slice(0, 6);
  }, [q.data, d]);
  return (
    <Section title={t('m04.fsc.forMe.title')} description={t('m04.fsc.forMe.intro')}>
      <Async state={q}>{() => picks.length === 0 ? <Callout tone="ok" title={t('m04.fsc.forMe.noneTitle')}>{t('m04.fsc.forMe.noneBody')}</Callout> : (
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m04-fsc-forme">
          {picks.map((p, i) => {
            const c = d.courseOf.get(p.course_id)!;
            return (
              <li key={p.course_id} className="card flex flex-col gap-2 p-4" data-course={p.course_id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="caps text-[10.5px]">{t('m04.fsc.forMe.rank', { n: f.num(i + 1) })}</span>
                    <L to={`/learn/course/${c.id}`} className="block font-semibold no-underline">{pick(c, 'title')}</L>
                  </div>
                  <WhyThis reasons={p.reasons} testId={`m04-fsc-why-${i}`} />
                </div>
                <p className="text-[12.5px] text-ink-3">{t('m04.fsc.forMe.gaps', { n: f.num(p.gaps) })}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {p.status === 'open'
                    ? <button type="button" className="btn-primary btn-sm" onClick={() => run(() => repo.rpc.enrolCourse(c.id, null), { success: t('m04.fsc.forMe.enrolled') })} data-testid="m04-fsc-enrol"><Icon name="plus" size={13} />{t('m04.fsc.forMe.enrol')}</button>
                    : <span className="text-[12.5px] text-ok">{t(`m04.fsc.forMe.${p.status}`)}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}</Async>
    </Section>
  );
}

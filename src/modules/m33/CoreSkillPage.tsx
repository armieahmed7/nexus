// FS25 /learn/core-skills/:id (public): one Nuclear Critical Core Skill. Definition and what it looks like at the plant, the three level
// descriptors, every benchmark mapping (kafaa_benchmarks chips), the INPO trait from M08, the catalogue skills that evidence it (FS02),
// its own development route and assessment route (why it passes the inclusion rule), the outcome note where wellbeing or career health
// belongs, the target for every job family, and sources with as-of dates. Signed-in staff get a practice shortcut.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, BenchmarkChips, Callout, DataTable, SourceLink, Icon, type Column } from '../../ui';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { CORE_MAX } from './coreSkills';
import { LevelPill, MappingList, RouteList, SkillLinks, useFamilyName, useM33Ref, type M33Ref, type Row } from './ui';

export default function CoreSkillPage() {
  const t = useT();
  const { id = '' } = useParams();
  const ref = useM33Ref();
  const name = ref.data?.core.find((c: Row) => c.id === id);
  const pick = usePick();
  return (
    <Page title={name ? pick(name, 'name') : t('m33.routes.learn-core-skill.title')} intro={name ? pick(name, 'summary') : undefined} wide eyebrow={<BenchmarkChips feature="FS25" />}
      actions={<L to="/learn/core-skills" className="btn-outline btn-sm no-underline" data-testid="m33-cs-back"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m33.cs.back')}</L>}>
      <Async state={ref}>{(d) => { const c = d.core.find((x: Row) => x.id === id); return c ? <Detail d={d} c={c} /> : <EmptyState title={t('m33.cs.notFound')} />; }}</Async>
    </Page>
  );
}

function Detail({ d, c }: { d: M33Ref; c: Row }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const lang = useLang();
  const famName = useFamilyName(d);
  const targets = d.targets.filter((x: Row) => x.core_skill_id === c.id);
  const traits = d.traits.filter((x: Row) => c.trait_ids.includes(x.id));
  const cols: Column<Row>[] = [
    { key: 'family', header: t('m33.cs.col.family'), value: (r) => famName(r.family_id), sortable: true },
    { key: 'level', header: t('m33.cs.col.target'), value: (r) => r.level, render: (r) => <LevelPill level={Number(r.level)} />, sortable: true },
    { key: 'why', header: t('m33.cs.col.why'), value: (r) => pick(r, 'rationale'), render: (r) => <span className="text-[12.5px] text-ink-2">{pick(r, 'rationale')}</span> },
  ];
  return (
    <div className="space-y-6" data-testid="m33-cs" data-id={c.id}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card eyebrow={<span className="num">{c.code} · {t(`m33.cluster.${c.cluster}`)}</span>} title={t('m33.cs.atPlant')}>
          <p className="text-[14px] text-ink-2">{pick(c, 'plant')}</p>
          <h3 className="caps mb-2 mt-4">{t('m33.cs.levels')}</h3>
          <ol className="space-y-2" data-testid="m33-cs-levels">
            {(c.descriptors as Row[]).map((x) => (
              <li key={x.level} className="flex items-start gap-3 rounded-card border border-line p-2.5" data-level={x.level}>
                <LevelPill level={x.level} />
                <span className="text-[13.5px]">{lang === 'ar' ? x.ar : x.en}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-ink-3">{t('m33.cs.levelsNote', { max: f.num(CORE_MAX) })}</p>
        </Card>
        <Card title={t('m33.cs.mappings')} eyebrow={t('m33.cs.mappingsEyebrow', { n: f.num(c.benchmark_ids.length) })}>
          <MappingList c={c} />
          {traits.length > 0 && (
            <p className="mt-3 text-[12.5px] text-ink-2" data-testid="m33-cs-traits">
              <Icon name="shield" size={12} className="me-1 inline text-accent" />
              {t('m33.cs.traits')} {traits.map((x: Row, i: number) => <span key={x.id}>{i > 0 && ', '}<L to="/safety-culture">{pick(x, 'name')}</L></span>)}
            </p>
          )}
          <h3 className="caps mb-1.5 mt-4">{t('m33.cs.catalogue')}</h3>
          <SkillLinks ids={c.skill_ids} d={d} />
        </Card>
      </div>

      <Section title={t('m33.cs.routes')} description={t('m33.cs.routesIntro')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title={t('m33.cs.develop')} eyebrow={t('m33.cs.developEyebrow')}>
            <p className="mb-3 text-[13px] text-ink-2">{pick(c, 'dev_approach')}</p>
            <RouteList routes={c.development} d={d} testId="m33-cs-dev" />
          </Card>
          <Card title={t('m33.cs.assess')} eyebrow={t('m33.cs.assessEyebrow')}>
            <p className="mb-3 text-[13px] text-ink-2">{pick(c, 'assess_approach')}</p>
            <RouteList routes={c.assessment} d={d} testId="m33-cs-assess" />
          </Card>
        </div>
        {c.outcome_en && <Callout tone="info" title={t('m33.cs.outcome')}>{pick(c, 'outcome')}</Callout>}
      </Section>

      <Section title={t('m33.cs.targets')} description={t('m33.cs.targetsIntro')}>
        <div data-testid="m33-cs-targets">
          <DataTable rows={targets} columns={cols} rowKey={(r) => r.id} searchable={false} pageSize={20} caption={t('m33.cs.targets')} dense initialSort={{ key: 'level', dir: 'desc' }} />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title={t('m33.cs.sources')}>
          <ul className="space-y-1.5 text-[13px]" data-testid="m33-cs-sources">
            {(c.sources as Row[]).map((x) => <li key={x.url}><SourceLink href={x.url} date={f.date(x.as_of)}>{x.label}</SourceLink></li>)}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">{t('m33.cs.version', { v: f.num(c.version), date: f.date(c.as_of) })}</p>
        </Card>
        <Card title={t('m33.cs.try')}>
          <p className="text-[13px] text-ink-2">{t('m33.cs.tryBody')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.identity.personId
              ? <L to={`/my/core-skills/practice?skill=${c.id}`} className="btn-primary no-underline" data-testid="m33-cs-practice">{t('m33.cs.tryBtn')}</L>
              : <L to="/sign-in" className="btn-outline no-underline">{t('m33.fw.cta.signInBtn')}</L>}
          </div>
        </Card>
      </div>
    </div>
  );
}

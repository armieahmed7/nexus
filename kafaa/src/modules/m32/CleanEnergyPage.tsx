// FS41 /skills/clean-energy (public): CleanEnergyComp, ENEC's sustainability competence framework. Twelve competences in four areas
// authored with the GreenComp method (JRC 2022), each with learning outcomes in EN and AR, the FS02 skills that evidence it and learning
// items; the level rule (the overall level is the lowest of the four areas; self-ratings never count); role targets for every job
// family; the framework checks and the public-copy check run live on the rows; links to the Jahiz New Economy group and Net Zero 2050.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, StatTile, BenchmarkChips, DataTable, Icon, StatusPill, type Column } from '../../ui';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { publicTextIsClean } from '../../domain/future';
import { CEC_MAX, frameworkProblems, targetProblems } from './cec';
import { AREA_ICON, AREA_LIST, LevelPill, SourceList, useCecRef, type CecRef, type Row } from './ui';

export default function CleanEnergyPage() {
  const t = useT();
  const ref = useCecRef();
  return (
    <Page title={t('m32.routes.skills-clean-energy.title')} intro={t('m32.fw.intro')} wide eyebrow={<BenchmarkChips feature="FS41" />}>
      <Async state={ref}>{(d) => <Framework d={d} />}</Async>
    </Page>
  );
}

function Framework({ d }: { d: CecRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const s = useSession();
  const [area, setArea] = useState<string>('all');
  // the learning items were checked by the seed builder and the validator; the public page re-checks the text rules it can see
  const problems = useMemo(() => frameworkProblems(d.comps, d.skills, () => true), [d.comps, d.skills]);
  const tProblems = useMemo(() => targetProblems(d.targets, d.families.map((x: Row) => x.id), d.comps.map((c: Row) => c.id)), [d.targets, d.families, d.comps]);
  const clean = publicTextIsClean(d.comps.map((c: Row) => [c.name_en, c.name_ar, c.summary_en, c.summary_ar, c.plant_en, c.plant_ar, c.outcomes]));
  const outcomes = d.comps.reduce((n: number, c: Row) => n + (c.outcomes?.length ?? 0), 0);
  const compName = (id: string) => { const c = d.comps.find((x: Row) => x.id === id); return c ? pick(c, 'name') : id; };
  const famName = (id: string) => { const x = d.families.find((y: Row) => y.id === id); return x ? pick(x, 'name') : id; };
  const shown = d.comps.filter((c: Row) => area === 'all' || c.area === area);
  const sources = d.comps[0]?.sources ?? [];
  const matrix: Column<Row>[] = [
    { key: 'code', header: t('m32.matrix.competence'), value: (c) => c.code, render: (c) => <L to={`/skills/clean-energy/${c.id}`}><span className="num me-1.5 text-[11.5px] text-ink-3">{c.code}</span>{pick(c, 'name')}</L>, sortable: true },
    { key: 'area', header: t('m32.matrix.greencomp'), value: (c) => c.area, render: (c) => <span className="text-[12.5px]">{t(`m32.greencomp.${c.area}`)}</span> },
    { key: 'outcomes', header: t('m32.matrix.outcomes'), align: 'end', value: (c) => c.outcomes.length, render: (c) => <span className="num">{f.num(c.outcomes.length)}</span> },
    { key: 'skills', header: t('m32.matrix.fs02'), align: 'end', value: (c) => c.skill_ids.filter((id: string) => d.skills.find((x: Row) => x.id === id)?.fs_area).length,
      render: (c) => <span className="num">{f.num(c.skill_ids.filter((id: string) => d.skills.find((x: Row) => x.id === id)?.fs_area).length)}</span> },
    { key: 'learning', header: t('m32.matrix.learning'), align: 'end', value: (c) => c.learning.length, render: (c) => <span className="num">{f.num(c.learning.length)}</span> },
    { key: 'tags', header: t('m32.matrix.tags'), value: (c) => `${c.jahiz_group}${c.net_zero}`, render: (c) => (
      <span className="flex flex-wrap gap-1 text-[11.5px]"><StatusPill tone="accent">{t('m32.tag.jahiz')}</StatusPill>{c.net_zero && <StatusPill tone="ok">{t('m32.tag.netZero')}</StatusPill>}</span>) },
  ];
  const targetCols: Column<Row>[] = [
    { key: 'family', header: t('m32.targets.family'), value: (r) => famName(r.family_id), render: (r) => <span className="font-semibold">{famName(r.family_id)}</span>, sortable: true },
    { key: 'level', header: t('m32.targets.level'), value: (r) => r.level, render: (r) => <LevelPill level={r.level} />, sortable: true },
    { key: 'focus', header: t('m32.targets.focus'), value: (r) => r.focus_ids.join(','), render: (r) => (
      <span className="flex flex-wrap gap-1">{r.focus_ids.map((id: string) => <L key={id} to={`/skills/clean-energy/${id}`} className="chip border-line bg-panel normal-case tracking-normal no-underline">{compName(id)}</L>)}</span>) },
    { key: 'why', header: t('m32.targets.why'), value: (r) => pick(r, 'rationale'), render: (r) => <span className="text-[12.5px] text-ink-2">{pick(r, 'rationale')}</span> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m32-fw-tiles">
        <StatTile label={t('m32.fw.tile.competences')} value={f.num(d.comps.length)} sub={t('m32.fw.tile.competencesSub')} />
        <StatTile label={t('m32.fw.tile.areas')} value={f.num(AREA_LIST.length)} sub={t('m32.fw.tile.areasSub')} />
        <StatTile label={t('m32.fw.tile.outcomes')} value={f.num(outcomes)} sub={t('m32.fw.tile.outcomesSub')} tone="ok" />
        <StatTile label={t('m32.fw.tile.targets')} value={f.num(d.targets.length)} sub={t('m32.fw.tile.targetsSub')} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Callout tone="info" title={t('m32.fw.method.title')}>{t('m32.fw.method.body')}</Callout>
        <Callout tone="ok" title={t('m32.fw.national.title')}>{t('m32.fw.national.body')}</Callout>
        <Callout tone="sim" title={t('m32.fw.rule.title')}>{t('m32.fw.rule.body')}</Callout>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('m32.fw.filter')} data-testid="m32-fw-areas">
        {['all', ...AREA_LIST].map((a) => (
          <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(a)} data-testid={`m32-fw-area-${a}`}
            className={`chip normal-case tracking-normal ${area === a ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`}>
            {a === 'all' ? t('m32.fw.all') : t(`m32.area.${a}`)}
            <span className="num text-ink-3">{f.num(a === 'all' ? d.comps.length : d.comps.filter((c: Row) => c.area === a).length)}</span>
          </button>
        ))}
      </div>

      {AREA_LIST.filter((a) => area === 'all' || a === area).map((a) => (
        <Section key={a} title={<span className="inline-flex items-center gap-2"><Icon name={AREA_ICON[a]} size={16} className="text-accent" />{t(`m32.area.${a}`)}</span>} description={t(`m32.areaSub.${a}`)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.filter((c: Row) => c.area === a).map((c: Row) => (
              <Card key={c.id} eyebrow={<span className="num">{c.code}</span>} title={<L to={`/skills/clean-energy/${c.id}`} className="text-inherit" data-testid="m32-fw-link">{pick(c, 'name')}</L>}>
                <div className="space-y-2.5" data-testid="m32-fw-competence" data-id={c.id}>
                  <p className="text-[13.5px] text-ink-2">{pick(c, 'summary')}</p>
                  <ul className="list-disc space-y-1 ps-5 text-[12.5px] text-ink-2" data-testid="m32-fw-outcomes">
                    {(c.outcomes as Row[]).map((o, i) => <li key={i}>{lang === 'ar' ? o.ar : o.en}</li>)}
                  </ul>
                  <p className="text-[12px] text-ink-3">{t('m32.fw.links', { skills: f.num(c.skill_ids.length), learning: f.num(c.learning.length) })}</p>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ))}

      <Section title={t('m32.matrix.title')} description={t('m32.matrix.intro')}>
        <div className="overflow-x-auto" data-testid="m32-fw-matrix"><DataTable rows={d.comps} columns={matrix} rowKey={(c) => c.id} searchable={false} pageSize={12} caption={t('m32.matrix.title')} dense /></div>
      </Section>

      <Section title={t('m32.levels.title')} description={t('m32.levels.intro')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m32-fw-levels">
          {Array.from({ length: CEC_MAX }, (_, i) => i + 1).map((n) => (
            <Card key={n} title={<LevelPill level={n} />}><p className="text-[13px] text-ink-2">{t(`m32.levels.d${n}`)}</p></Card>
          ))}
        </div>
      </Section>

      <Section title={t('m32.targets.title')} description={t('m32.targets.intro')}>
        <div className="overflow-x-auto" data-testid="m32-fw-targets"><DataTable rows={[...d.targets].sort((a, b) => b.level - a.level || famName(a.family_id).localeCompare(famName(b.family_id)))} columns={targetCols} rowKey={(r) => r.id} searchable={false} pageSize={20} caption={t('m32.targets.title')} dense /></div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title={t('m32.check.title')} eyebrow={t('m32.check.eyebrow')}>
          <div data-testid="m32-fw-check" data-problems={problems.length + tProblems.length} data-clean={clean ? 'true' : 'false'}>
            {problems.length + tProblems.length === 0
              ? <p className="flex items-center gap-2 text-[14px] text-ok"><Icon name="check" size={16} />{t('m32.check.pass', { n: f.num(d.comps.length), m: f.num(d.targets.length) })}</p>
              : <ul className="text-[13px] text-bad">{problems.map((p) => <li key={`${p.id}-${p.code}`}>{compName(p.id)}: {t(`m32.check.problem.${p.code}`)}</li>)}{tProblems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <p className={`mt-2 flex items-center gap-2 text-[13px] ${clean ? 'text-ok' : 'text-bad'}`}><Icon name={clean ? 'check' : 'alert'} size={14} />{t(clean ? 'm32.check.clean' : 'm32.check.unclean')}</p>
          </div>
        </Card>
        <Card title={t('m32.fw.sources')}><SourceList sources={sources} testId="m32-fw-sources" /></Card>
      </div>

      <Card title={s.identity.personId ? t('m32.fw.cta.mine') : t('m32.cta.signInTitle')}>
        <div className="flex flex-wrap items-center gap-3" data-testid="m32-fw-cta">
          <p className="text-[13.5px] text-ink-2">{t('m32.fw.cta.body')}</p>
          {s.identity.personId
            ? <><L to="/my/clean-energy" className="btn-primary no-underline" data-testid="m32-fw-mine">{t('m32.fw.cta.mineBtn')}</L><L to="/learn/energy-transition" className="btn-outline no-underline">{t('m32.fw.cta.learnBtn')}</L></>
            : <L to="/sign-in" className="btn-primary no-underline" data-testid="m32-signin">{t('m32.cta.signIn')}</L>}
        </div>
      </Card>
    </div>
  );
}

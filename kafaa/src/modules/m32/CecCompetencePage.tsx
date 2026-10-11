// FS41 /skills/clean-energy/:id (public): one CleanEnergyComp competence: area and GreenComp area, what it means at a nuclear plant, its
// learning outcomes side by side in English and Arabic, the FS02 and established skills that evidence it, learning items, the job
// families that focus on it, the national tags and the sources with as-of dates.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, BenchmarkChips, DataTable, Icon, StatusPill, type Column } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { AreaChip, LearningLink, LevelPill, SkillChips, SourceList, useCecRef, type CecRef, type Row } from './ui';

export default function CecCompetencePage() {
  const t = useT();
  const { id = '' } = useParams();
  const ref = useCecRef();
  return (
    <Page title={t('m32.routes.skills-clean-energy-competence.title')} intro={t('m32.comp.intro')} wide eyebrow={<BenchmarkChips feature="FS41" />}
      actions={<L to="/skills/clean-energy" className="btn-outline btn-sm no-underline"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m32.comp.back')}</L>}>
      <Async state={ref}>{(d) => {
        const c = d.comps.find((x: Row) => x.id === id);
        return c ? <Competence c={c} d={d} /> : <EmptyState title={t('m32.comp.notFound')} />;
      }}</Async>
    </Page>
  );
}

function Competence({ c, d }: { c: Row; d: CecRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const fam = (fid: string) => { const x = d.families.find((y: Row) => y.id === fid); return x ? pick(x, 'name') : fid; };
  const focus = d.targets.filter((x: Row) => x.focus_ids.includes(c.id));
  const cols: Column<Row>[] = [
    { key: 'family', header: t('m32.targets.family'), value: (r) => fam(r.family_id), render: (r) => <span className="font-semibold">{fam(r.family_id)}</span>, sortable: true },
    { key: 'level', header: t('m32.targets.level'), value: (r) => r.level, render: (r) => <LevelPill level={r.level} />, sortable: true },
    { key: 'why', header: t('m32.targets.why'), value: (r) => pick(r, 'rationale'), render: (r) => <span className="text-[12.5px] text-ink-2">{pick(r, 'rationale')}</span> },
  ];
  return (
    <div className="space-y-6" data-testid="m32-comp" data-id={c.id}>
      <Card eyebrow={<span className="flex flex-wrap items-center gap-2"><span className="num">{c.code}</span><AreaChip area={c.area} /></span>} title={<span data-testid="m32-comp-title">{pick(c, 'name')}</span>}>
        <p className="text-[14px] text-ink-2">{pick(c, 'summary')}</p>
        <p className="mt-3 rounded-card border border-line bg-sunken p-2.5 text-[13px] text-ink-2"><span className="caps me-1 text-[10.5px]">{t('m32.comp.atPlant')}</span>{pick(c, 'plant')}</p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
          <span>{t('m32.comp.greencomp', { area: t(`m32.greencomp.${c.area}`) })}</span>
          <StatusPill tone="accent">{t('m32.tag.jahiz')}</StatusPill>{c.net_zero && <StatusPill tone="ok">{t('m32.tag.netZero')}</StatusPill>}
        </p>
      </Card>

      <Section title={t('m32.comp.outcomes')} description={t('m32.comp.outcomesIntro')}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" data-testid="m32-comp-outcomes">
            <thead><tr className="border-b border-line text-start text-ink-3"><th className="p-2 text-start">{t('m32.comp.colEn')}</th><th className="p-2 text-start">{t('m32.comp.colAr')}</th></tr></thead>
            <tbody>{(c.outcomes as Row[]).map((o, i) => (
              <tr key={i} className="border-b border-line align-top"><td className="p-2" dir="ltr" lang="en">{o.en}</td><td className="p-2" dir="rtl" lang="ar">{o.ar}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m32.comp.skills')} eyebrow={t('m32.comp.skillsEyebrow', { n: f.num(c.skill_ids.length) })}>
          <SkillChips ids={c.skill_ids} skills={d.skills} testId="m32-comp-skills" />
          <p className="mt-2 text-[12px] text-ink-3">{t('m32.comp.skillsNote')}</p>
        </Card>
        <Card title={t('m32.comp.learning')} eyebrow={t('m32.comp.learningEyebrow', { n: f.num(c.learning.length) })}>
          <ul className="space-y-1.5" data-testid="m32-comp-learning">{(c.learning as Row[]).map((r) => <li key={`${r.kind}:${r.ref}`}><LearningLink r={r} /></li>)}</ul>
        </Card>
      </div>

      <Section title={t('m32.comp.focusTitle')} description={t('m32.comp.focusIntro')}>
        {focus.length ? <div className="overflow-x-auto" data-testid="m32-comp-focus"><DataTable rows={focus} columns={cols} rowKey={(r) => r.id} searchable={false} pageSize={20} caption={t('m32.comp.focusTitle')} dense /></div>
          : <EmptyState title={t('m32.comp.noFocus')} />}
      </Section>

      <Card title={t('m32.fw.sources')}><SourceList sources={c.sources ?? []} testId="m32-comp-sources" /></Card>
    </div>
  );
}

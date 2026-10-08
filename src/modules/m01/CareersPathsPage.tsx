// M01 /careers/paths: the three progression views (hierarchy, family, path graph) plus the licensed operator ladder
// (Local Operator -> RO -> SRO -> Shift Supervisor) with the structured condition on each step.
import { useMemo } from 'react';
import { Page, Section, Card, Grid, Async, EmptyState, Tabs, CareerLadder, PathGraph, StatusPill, Callout, SourceLink, FilterBar, useFilters } from '../../ui';
import { useT, usePick, useI18n, useNav, L, useFormat } from '../../i18n';
import { useCareerData, BasisBadge, EdgeCard, CareerSourcesFooter, useConditionText, LEVELS, type CareerData } from './shared';
import { ladderSteps, edgeMonths, neighbours } from './careerGraph';

export default function CareersPathsPage() {
  const t = useT();
  const q = useCareerData();
  const [v, setV] = useFilters({ view: 'ladder', family: '', type: '' }, true);
  return (
    <Page
      title={t('m01.routes.careers-paths.title')}
      intro={t('m01.paths.intro')}
      wide
      actions={
        <L to="/careers/plan" className="btn-primary" data-testid="m01-paths-plan">
          {t('m01.careers.toPlan')}
        </L>
      }
    >
      <Async state={q}>
        {(d) => (
          <Tabs
            value={v.view}
            onChange={(id) => setV({ view: id })}
            tabs={[
              { id: 'ladder', label: t('m01.paths.tabLadder'), content: <LadderView data={d} /> },
              { id: 'hierarchy', label: t('m01.paths.tabHierarchy'), content: <HierarchyView data={d} /> },
              { id: 'family', label: t('m01.paths.tabFamily'), content: <FamilyView data={d} family={v.family || d.families[0]?.id} setFamily={(family) => setV({ family })} /> },
              { id: 'graph', label: t('m01.paths.tabGraph'), content: <GraphView data={d} type={v.type} setType={(type) => setV({ type })} /> },
            ]}
          />
        )}
      </Async>
    </Page>
  );
}

function LadderView({ data }: { data: CareerData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const nav = useNav();
  const condText = useConditionText();
  const steps = ladderSteps(data.paths);
  const entries = data.paths.filter((e) => !e.from_role_id && ['local-operator', 'reactor-operator', 'senior-reactor-operator'].includes(e.to_role_id));
  const reg17 = data.sourceById.get('fanr-reg17');
  const ssg = data.sourceById.get('ssg75');
  return (
    <div className="space-y-6">
      <Callout tone="info" title={t('m01.ladder.calloutTitle')}>
        {t('m01.ladder.calloutBody')}
      </Callout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title={t('m01.ladder.title')} description={t('m01.ladder.desc')}>
          <CareerLadder
            onSelect={(id) => nav(`/careers/roles/${id}`)}
            steps={steps.map((s) => {
              const role = data.roleById.get(s.role);
              const m = s.edge ? edgeMonths(s.edge) : 0;
              return {
                id: s.role,
                title: (
                  <span className="flex flex-wrap items-center gap-2">
                    {pick(role, 'title')}
                    {role && <BasisBadge basis={s.edge?.basis ?? role.basis} />}
                  </span>
                ),
                sub: s.edge ? `${pick(s.edge, 'label')}${m ? ` · ${t('m01.months', { n: f.num(m) })}` : ''}${s.edge.rule_ref ? ` · ${s.edge.rule_ref}` : ''}` : pick(role, 'licensing_body'),
                conditions: s.edge ? condText(s.edge) : [t('m01.ladder.loCondition')],
              };
            })}
          />
        </Section>
        <div className="space-y-4">
          <Card title={t('m01.ladder.entryTitle')}>
            <div className="space-y-2" data-testid="m01-ladder-entries">
              {entries.map((e) => (
                <EdgeCard key={e.id} edge={e} title={`${pick({ x_en: e.from_label_en, x_ar: e.from_label_ar }, 'x')} → ${pick(data.roleById.get(e.to_role_id), 'title')}`} conds={condText(e)} />
              ))}
            </div>
          </Card>
          <Card title={t('m01.ladder.whileTitle')} footer={reg17 && <SourceLink href={reg17.url} date={reg17.accessed}>{reg17.label}</SourceLink>}>
            <ul className="list-disc space-y-1 ps-5 text-[13.5px]" data-testid="m01-while-certified">
              <li>{t('m01.ladder.w1')}</li>
              <li>{t('m01.ladder.w2')}</li>
              <li>{t('m01.ladder.w3')}</li>
              <li>{t('m01.ladder.w4')}</li>
              <li>{t('m01.ladder.w5')}</li>
            </ul>
            <div className="mt-2 text-[12.5px]">
              <L to="/licensing">{t('m01.ladder.toLicensing')}</L>
            </div>
          </Card>
          <Callout tone="sim" title={t('m01.basis.uncertain')}>
            {t('m01.ladder.ssNote')} {ssg && <SourceLink href={ssg.url}>{ssg.label}</SourceLink>}
          </Callout>
        </div>
      </div>
      <CareerSourcesFooter data={data} ids={['fanr-reg17', 'ssg75', 'sr2024', 'cns10']} />
    </div>
  );
}

function HierarchyView({ data }: { data: CareerData }) {
  const t = useT();
  const pick = usePick();
  return (
    <div className="space-y-3">
      <p className="text-ink-2">{t('m01.paths.hierarchyDesc')}</p>
      <div className="card overflow-x-auto p-0">
        <table className="table-base w-full min-w-[720px]" data-testid="m01-hierarchy">
          <thead>
            <tr>
              <th className="text-start">{t('m01.f.family')}</th>
              {LEVELS.map((l) => (
                <th key={l} className="text-start">
                  {t(`m01.level.${l}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.families.map((fam) => {
              const rs = data.roles.filter((r) => r.family_id === fam.id);
              if (!rs.length) return null;
              return (
                <tr key={fam.id}>
                  <th scope="row" className="text-start align-top font-semibold">
                    {pick(fam, 'name')}
                  </th>
                  {LEVELS.map((l) => (
                    <td key={l} className="align-top">
                      <ul className="space-y-1">
                        {rs
                          .filter((r) => r.level === l)
                          .map((r) => (
                            <li key={r.id}>
                              <L to={`/careers/roles/${r.id}`} className="text-[13px]">
                                {pick(r, 'title')}
                              </L>
                            </li>
                          ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FamilyView({ data, family, setFamily }: { data: CareerData; family: string; setFamily: (f: string) => void }) {
  const t = useT();
  const pick = usePick();
  const condText = useConditionText();
  const fam = data.familyById.get(family);
  const roles = data.roles.filter((r) => r.family_id === family);
  const ids = new Set(roles.map((r) => r.id));
  const edges = data.paths.filter((e) => (e.from_role_id && ids.has(e.from_role_id)) || ids.has(e.to_role_id));
  return (
    <div className="space-y-4">
      <FilterBar value={{ family }} onChange={(v) => setFamily(v.family ?? '')} fields={[{ key: 'family', label: t('m01.f.family'), options: data.families.map((x) => ({ value: x.id, label: pick(x, 'name') })) }]} />
      {fam && <p className="text-ink-2">{pick(fam, 'description')}</p>}
      <Grid cols={3}>
        {roles.map((r) => (
          <Card key={r.id} title={<L to={`/careers/roles/${r.id}`}>{pick(r, 'title')}</L>} eyebrow={t(`m01.level.${r.level}`)}>
            <BasisBadge basis={r.basis} />
          </Card>
        ))}
      </Grid>
      <Section title={t('m01.paths.familyEdges')}>
        {edges.length === 0 ? (
          <EmptyState title={t('m01.paths.noFamilyEdges')} />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="m01-family-edges">
            {edges.map((e) => (
              <EdgeCard
                key={e.id}
                edge={e}
                title={`${e.from_role_id ? pick(data.roleById.get(e.from_role_id), 'title') : pick({ x_en: e.from_label_en, x_ar: e.from_label_ar }, 'x')} → ${pick(data.roleById.get(e.to_role_id), 'title')}`}
                conds={condText(e)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function GraphView({ data, type, setType }: { data: CareerData; type: string; setType: (t: string) => void }) {
  const t = useT();
  const pick = usePick();
  const nav = useNav();
  const { dir } = useI18n();
  const edges = useMemo(() => data.paths.filter((e) => e.from_role_id && (!type || e.type === type)), [data.paths, type]);
  const ids = new Set(edges.flatMap((e) => [e.from_role_id!, e.to_role_id]));
  const nodes = data.roles.filter((r) => ids.has(r.id)).map((r) => ({ id: r.id, label: pick(r, 'title').replace(/\s*\(.*\)$/, ''), group: r.family_id }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('m01.paths.edgeTypes')}>
        {['', 'vertical', 'lateral', 'cross_functional'].map((ty) => (
          <button key={ty || 'all'} className={`chip ${type === ty ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} aria-pressed={type === ty} onClick={() => setType(ty)}>
            {ty ? t(`m01.edgeType.${ty}`) : t('common.all')}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-ink-2">{t('m01.paths.graphHint')}</p>
      <div className="card p-3">
        <PathGraph nodes={nodes} edges={edges.map((e) => ({ from: e.from_role_id!, to: e.to_role_id }))} onSelect={(id) => nav(`/careers/roles/${id}`)} rtl={dir === 'rtl'} />
      </div>
      <details className="card p-3">
        <summary className="cursor-pointer font-semibold">{t('m01.paths.asList', { n: edges.length })}</summary>
        <ul className="mt-2 space-y-1 text-[13px]" data-testid="m01-graph-list">
          {edges.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-1.5">
              <L to={`/careers/roles/${e.from_role_id}`}>{pick(data.roleById.get(e.from_role_id!), 'title')}</L>
              <span aria-hidden>→</span>
              <L to={`/careers/roles/${e.to_role_id}`}>{pick(data.roleById.get(e.to_role_id), 'title')}</L>
              <StatusPill tone="neutral">{t(`m01.edgeType.${e.type}`)}</StatusPill>
              <span className="text-ink-3">{pick(e, 'label')}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="text-[12.5px] text-ink-3">{t('m01.paths.isolated', { n: data.roles.filter((r) => !neighbours(data.paths, r.id).next.length && !neighbours(data.paths, r.id).prev.length).length })}</p>
    </div>
  );
}

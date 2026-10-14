// M01 /careers/plan: "path to role" planner. From a current role (or from outside, via the entry routes) to a target role:
// candidate routes over the progression edges with their structured conditions and indicative minimum months, the
// competency gap, the qualification standards the target role holds, and an exportable plan. General guidance only.
import { useMemo } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatusPill, SelectField, ProgressBar, downloadText, Icon, Stepper, useFilters } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L, useFormat, useRefText } from '../../i18n';
import { useSession } from '../../auth/session';
import { useCareerData, EdgeCard, useConditionText, useArrow, type CareerData, type Edge } from './shared';
import { findPaths, pathMonths, competencyGap, reachable } from './careerGraph';
import { ConceptBanner, useProfileData, useReqLabel } from './horizons';
import { publishedByHorizon, reqsOf } from './roleProfiles';

export default function CareersPlanPage() {
  const t = useT();
  const q = useCareerData();
  return (
    <Page title={t('m01.routes.careers-plan.title')} intro={t('m01.plan.intro')}>
      <Async state={q}>{(d) => <Planner data={d} />}</Async>
    </Page>
  );
}

function Planner({ data }: { data: CareerData }) {
  const t = useT();
  const pick = usePick();
  const refText = useRefText();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const condText = useConditionText();
  const arrow = useArrow();
  const mine = s.person?.job_role_id ?? '';
  const [p, setP] = useFilters({ from: '', to: '' }, true);
  const from = p.from === 'none' ? '' : p.from || mine;
  const to = p.to;
  const extra = useQuery(['role_competencies', 'competencies', 'qual_standards'], async () => {
    const [rc, comps, stds] = await Promise.all([repo.list('role_competencies'), repo.list('competencies'), repo.list('qual_standards', { filter: { status: 'current' } })]);
    return { rc, compById: new Map(comps.map((c) => [c.id, c])), stds };
  });

  // FS05: a concept future role can be a target; its inbound 'future' edges join the graph only then
  const concept = data.conceptById.get(to);
  const graph = useMemo(() => (concept ? [...data.paths, ...data.futurePaths] : data.paths), [concept, data.paths, data.futurePaths]);
  const profiles = useProfileData();
  const reqLabel = useReqLabel(profiles.data);
  const conceptReqs = useMemo(() => {
    if (!concept || !profiles.data) return [];
    const v = publishedByHorizon(profiles.data.versions, concept.id);
    return reqsOf(v['2035'] ?? v['2030']);
  }, [concept, profiles.data]);
  const routes: Edge[][] = useMemo(() => {
    if (!to) return [];
    if (from) return findPaths(graph, from, to);
    // From outside: an entry edge, then progression to the target.
    const out: Edge[][] = [];
    for (const e of graph.filter((x) => !x.from_role_id)) {
      if (e.to_role_id === to) out.push([e]);
      else for (const rest of findPaths(graph, e.to_role_id, to, 5, 3)) out.push([e, ...rest]);
    }
    return out.sort((a, b) => a.length - b.length || pathMonths(a) - pathMonths(b)).slice(0, 5);
  }, [graph, from, to]);
  const next = useMemo(() => (from ? [...reachable([...data.paths, ...data.futurePaths], from).entries()].sort((a, b) => a[1] - b[1]) : []), [data.paths, data.futurePaths, from]);
  const roleOpts = data.roles.map((r) => ({ value: r.id, label: pick(r, 'title') }));
  const targetOpts = [...roleOpts, ...data.concepts.map((r) => ({ value: r.id, label: pick(r, 'title') }))];
  const target = data.anyRoleById.get(to);

  const exportPlan = () => {
    const lines = [
      `${t('m01.routes.careers-plan.title')} · ${t('shell.brand')}`,
      `${t('m01.plan.from')}: ${from ? pick(data.roleById.get(from), 'title') : t('m01.plan.fromNone')}`,
      `${t('m01.plan.to')}: ${pick(target, 'title')}`,
      '',
      ...routes.flatMap((r, i) => [
        `${t('m01.plan.routeN', { n: i + 1 })} (${t('m01.plan.minMonths', { n: pathMonths(r) })})`,
        ...r.flatMap((e) => [`  ${arrow} ${pick(data.anyRoleById.get(e.to_role_id), 'title')}: ${pick(e, 'label')}${e.rule_ref ? ` [${refText(pick(e, 'rule_ref'))}]` : ''}`, ...condText(e).map((c) => `      - ${c}`)]),
        '',
      ]),
      t('m01.plan.disclaimer'),
    ];
    downloadText(`kafaa-path-${from || 'entry'}-to-${to}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8');
  };

  return (
    <>
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="m01-plan-form">
          <SelectField label={t('m01.plan.from')} name="from" value={p.from || (mine ? mine : 'none')} onChange={(v) => setP({ from: v })} options={[{ value: 'none', label: t('m01.plan.fromNone') }, ...roleOpts]} hint={mine ? t('m01.plan.fromMine') : undefined} />
          <SelectField label={t('m01.plan.to')} name="to" value={to} onChange={(v) => setP({ to: v })} options={targetOpts} placeholder={t('common.choose')} />
        </div>
      </Card>

      {!to ? (
        <>
          <EmptyState title={t('m01.plan.pickTarget')} icon="sparkle">
            {t('m01.plan.pickTargetBody')}
          </EmptyState>
          {next.length > 0 && (
            <Section title={t('m01.plan.reachable')}>
              <ul className="flex flex-wrap gap-2" data-testid="m01-plan-reachable">
                {next.map(([id, n]) => (
                  <li key={id}>
                    <button className="chip border-line bg-panel" onClick={() => setP({ to: id })}>
                      {pick(data.anyRoleById.get(id), 'title')} · {t('m01.plan.steps', { n: f.num(n) })}
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      ) : from === to ? (
        <Callout tone="info">{t('m01.plan.same')}</Callout>
      ) : (
        <>
          {concept && (
            <div className="space-y-2" data-testid="m01-plan-concept">
              <ConceptBanner />
              {conceptReqs.some((q) => q.kind === 'skill') && (
                <Card title={t('m01.fs05.plan.skillsTitle')}>
                  <ul className="flex flex-wrap gap-1.5">
                    {conceptReqs
                      .filter((q) => q.kind === 'skill')
                      .map((q) => (
                        <li key={q.ref_id} className="chip border-line bg-sunken">
                          {reqLabel(q)} · <span className="num">{f.num(q.level)}</span>
                        </li>
                      ))}
                  </ul>
                  <L to={`/careers/roles/${concept.id}`} className="mt-2 inline-block text-[12.5px]">
                    {t('m01.fs05.plan.seeProfile')}
                  </L>
                </Card>
              )}
            </div>
          )}
          <Section
            title={t('m01.plan.routesTitle')}
            description={routes.length ? t('m01.plan.routesDesc', { n: routes.length }) : undefined}
            actions={
              routes.length > 0 && (
                <button className="btn-outline btn-sm" onClick={exportPlan} data-testid="m01-plan-export">
                  <Icon name="download" size={14} className="me-1 inline" />
                  {t('m01.plan.export')}
                </button>
              )
            }
          >
            {routes.length === 0 ? (
              <EmptyState title={t('m01.plan.noRoute')}>{t('m01.plan.noRouteBody')}</EmptyState>
            ) : (
              <ol className="space-y-4" data-testid="m01-plan-routes">
                {routes.map((r, i) => (
                  <li key={r.map((e) => e.id).join('>')}>
                    <Card
                      eyebrow={i === 0 ? t('m01.plan.shortest') : t('m01.plan.alternative')}
                      title={t('m01.plan.routeN', { n: i + 1 })}
                      actions={<StatusPill tone="neutral">{t('m01.plan.minMonths', { n: f.num(pathMonths(r)) })}</StatusPill>}
                    >
                      <Stepper current={-1} steps={[{ id: 'start', label: from ? pick(data.roleById.get(from), 'title') : pick({ x_en: r[0].from_label_en, x_ar: r[0].from_label_ar }, 'x') }, ...r.map((e) => ({ id: e.id, label: pick(data.anyRoleById.get(e.to_role_id), 'title') }))]} />
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {r.map((e) => (
                          <EdgeCard key={e.id} edge={e} to={data.anyRoleById.get(e.to_role_id)} conds={condText(e)} />
                        ))}
                      </div>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Async state={extra}>
            {(x) => {
              const rc = concept
                ? [...x.rc, ...conceptReqs.filter((q) => q.kind === 'competency').map((q) => ({ role_id: to, competency_id: q.ref_id, required_level: q.level, importance: q.importance }))]
                : x.rc;
              const gap = competencyGap(rc, from || null, to);
              const stds = x.stds.filter((st) => (st.role_ids ?? []).includes(to));
              const closed = gap.filter((g) => g.gap === 0).length;
              return (
                <>
                  <Section title={t('m01.plan.gapTitle')} description={t('m01.plan.gapDesc', { done: f.num(closed), total: f.num(gap.length) })}>
                    {gap.length === 0 ? (
                      <EmptyState title={t('m01.plan.noGap')} />
                    ) : (
                      <div className="card overflow-x-auto p-0">
                        <table className="table-base w-full" data-testid="m01-plan-gap">
                          <thead>
                            <tr>
                              <th className="text-start">{t('m01.role.competency')}</th>
                              <th className="text-start">{t('m01.plan.have')}</th>
                              <th className="text-start">{t('m01.plan.need')}</th>
                              <th className="text-start">{t('m01.plan.gap')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gap.map((g) => {
                              const c = x.compById.get(g.competency_id);
                              return (
                                <tr key={g.competency_id}>
                                  <td>
                                    <span className="num me-1.5 text-ink-3">{c?.code}</span>
                                    {pick(c, 'name')}
                                  </td>
                                  <td className="num">{f.num(g.have)}</td>
                                  <td className="num">{f.num(g.need)}</td>
                                  <td className="w-[30%]">
                                    {g.gap === 0 ? <StatusPill status="met">{t('m01.plan.met')}</StatusPill> : <ProgressBar value={(g.have / g.need) * 100} tone="sim" label={t('m01.plan.levelsToGo', { n: f.num(g.gap) })} />}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Section>
                  {stds.length > 0 && (
                    <Section title={t('m01.plan.standardsTitle')} description={t('m01.plan.standardsDesc')}>
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {stds.map((st) => (
                          <li key={st.id} className="card p-3">
                            <div className="caps">{st.code}</div>
                            <div className="font-semibold">{pick(st, 'title')}</div>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              );
            }}
          </Async>

          {target?.regulated && (
            <Callout tone="info" title={t('m01.plan.regulatedTitle')}>
              {t('m01.plan.regulatedBody')} <L to="/licensing">{t('m01.ladder.toLicensing')}</L>
            </Callout>
          )}
          <p className="text-[12.5px] text-ink-3">{t('m01.plan.disclaimer')}</p>
          {s.can('dev_plans', ['Own']) && (
            <L to="/my/plan" className="btn-outline btn-sm" data-testid="m01-plan-to-idp">
              {t('m01.plan.toIdp')}
            </L>
          )}
        </>
      )}
    </>
  );
}

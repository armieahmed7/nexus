// M01 /careers/roles/:slug: what the role does, qualifications, training path, licensing body, entry routes (with article
// references for RO/SRO), next and previous roles with conditions, related competencies, qualification standards, sources,
// "Ask Dalil about this role". No incumbent is named or pictured; internal grade, pay and headcount never render here.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Grid, Async, EmptyState, KeyValue, Callout, StatusPill, SourceLink, Icon, Tabs, useFilters } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L, useFormat } from '../../i18n';
import { useCrumbLabel } from '../../shell/crumbs';
import { useCareerData, RoleBadges, RoleSources, useConditionText, EdgeCard, type CareerData, type Role } from './shared';
import { neighbours } from './careerGraph';
import { RoleHorizonsTab, ConceptRoleView } from './RoleHorizons';
import { RoleOutlookLine } from '../m18/futureUi'; // FS wave B: FS16 label (public: label only; staff: with components)

type EntryRoute = { id: string; en: string; ar: string; rule_ref?: string; url?: string };

export default function CareersRolePage() {
  const t = useT();
  const { slug = '' } = useParams();
  const q = useCareerData();
  const role = q.data?.anyRoleById.get(slug);
  const pick = usePick();
  useCrumbLabel(role ? pick(role, 'title') : null);
  if (q.data && !role)
    return (
      <Page title={t('m01.routes.careers-role.title')}>
        <EmptyState title={t('m01.role.notFound')} action={<L to="/careers" className="btn-outline btn-sm">{t('m01.role.backToMap')}</L>}>
          {t('m01.role.notFoundBody', { slug })}
        </EmptyState>
      </Page>
    );
  return (
    <Async state={q}>
      {(d) => (role ? role.lifecycle === 'concept' ? <ConceptRoleView role={role} data={d} /> : <RoleView role={role} data={d} /> : null)}
    </Async>
  );
}

function RoleView({ role, data }: { role: Role; data: CareerData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const condText = useConditionText();
  const fam = data.familyById.get(role.family_id);
  const extra = useQuery(['role_responsibilities', 'role_competencies', 'competencies', 'proficiency_levels', 'qual_standards'], async () => {
    const [resp, rc, comps, levels, stds] = await Promise.all([
      repo.list('role_responsibilities', { filter: { role_id: role.id }, order: [['sort', 'asc']] }),
      repo.list('role_competencies', { filter: { role_id: role.id } }),
      repo.list('competencies'),
      repo.list('proficiency_levels', { order: [['level', 'asc']] }),
      repo.list('qual_standards', { filter: { status: 'current' } }),
    ]);
    return { resp, rc: rc.sort((a, b) => b.required_level - a.required_level), compById: new Map(comps.map((c) => [c.id, c])), levels, stds: stds.filter((s) => (s.role_ids ?? []).includes(role.id)) };
  }, [role.id]);
  const { next, prev, entry } = neighbours(data.paths, role.id);
  const routes = (Array.isArray(role.entry_routes) ? (role.entry_routes as EntryRoute[]) : []).filter((r) => r.id !== 'clearance');
  const clearance = (Array.isArray(role.entry_routes) ? (role.entry_routes as EntryRoute[]) : []).find((r) => r.id === 'clearance');
  const dalilQ = encodeURIComponent(t('m01.role.askQuestion', { role: pick(role, 'title') }));
  const [tab, setTab] = useFilters({ tab: 'overview' }, true);

  return (
    <Page
      title={pick(role, 'title')}
      eyebrow={`${pick(fam, 'name')} · ${t(`m01.level.${role.level}`)}`}
      intro={pick(role, 'summary')}
      actions={
        <>
          <L to={`/ask?q=${dalilQ}`} className="btn-outline" data-testid="m01-ask-dalil">
            <Icon name="chat" size={14} className="me-1.5 inline" />
            {t('m01.role.askDalil')}
          </L>
          <L to={`/careers/plan?to=${role.id}`} className="btn-primary" data-testid="m01-plan-to-role">
            {t('m01.role.planTo')}
          </L>
        </>
      }
    >
      <RoleBadges role={role} />
      <RoleOutlookLine roleId={role.id} />
      {role.basis !== 'barakah' && (
        <Callout tone="sim" title={t(`m01.basis.${role.basis}`)}>
          {pick(role, 'basis_note') || t(`m01.basis.${role.basis}Hint`)}
        </Callout>
      )}
      {role.security_sensitive && (
        <Callout tone="info" title={t('m01.role.securityTitle')}>
          {t('m01.role.securityBody')}
        </Callout>
      )}

      <Tabs
        value={tab.tab}
        onChange={(id) => setTab({ tab: id })}
        tabs={[
          {
            id: 'overview',
            label: t('m01.fs05.tabOverview'),
            content: (
              <div className="space-y-6">
          <Grid cols={2}>
            <Card title={t('m01.role.what')}>
              <Async state={extra} empty={<p className="text-ink-2">{pick(role, 'summary')}</p>} isEmpty={(x) => x.resp.length === 0}>
                {(x) => (
                  <ul className="list-disc space-y-1 ps-5" data-testid="m01-responsibilities">
                    {x.resp.map((r) => (
                      <li key={r.id}>{pick(r, 'text')}</li>
                    ))}
                  </ul>
                )}
              </Async>
            </Card>
            <Card title={t('m01.role.facts')}>
              <KeyValue
                items={[
                  [t('m01.role.function'), pick(role, 'function') || '—'],
                  [t('m01.f.education'), t(`m01.education.${role.education}`)],
                  [t('m01.role.licensingBody'), pick(role, 'licensing_body')],
                  [
                    t('m01.role.regulation'),
                    role.regulated && role.regulation_ref ? (
                      role.regulation_url ? (
                        <SourceLink href={role.regulation_url}>{pick(role, 'regulation_ref')}</SourceLink>
                      ) : (
                        pick(role, 'regulation_ref')
                      )
                    ) : (
                      t('m01.role.notRegulated')
                    ),
                  ],
                ]}
              />
            </Card>
          </Grid>

          <Grid cols={2}>
            <Card title={t('m01.role.qualifications')}>
              <p className="text-[14px]">{pick(role, 'qualifications')}</p>
            </Card>
            <Card title={t('m01.role.trainingPath')}>
              <p className="text-[14px]">{pick(role, 'training_path')}</p>
              <div className="mt-2 text-[12.5px]">
                <L to="/learn">{t('m01.role.seeCatalogue')}</L>
              </div>
            </Card>
          </Grid>

          {(routes.length > 0 || entry.length > 0) && (
            <Section title={t('m01.role.entryRoutes')} description={routes.length ? t('m01.role.entryRoutesDesc') : undefined}>
              {routes.length > 0 && (
                <ol className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m01-entry-routes">
                  {routes.map((r, i) => (
                    <li key={r.id} className="card p-4">
                      <div className="caps mb-1">{t('m01.role.routeN', { n: i + 1 })}</div>
                      <p className="text-[14px]">{pick({ x_en: r.en, x_ar: r.ar }, 'x')}</p>
                      {r.rule_ref && (
                        <div className="mt-2">
                          {r.url ? <SourceLink href={r.url}>{r.rule_ref}</SourceLink> : <span className="chip border-line bg-sunken">{r.rule_ref}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {clearance && <Callout tone="info">{pick({ x_en: clearance.en, x_ar: clearance.ar }, 'x')}</Callout>}
              {entry.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {entry.map((e) => (
                    <EdgeCard key={e.id} edge={e} title={pick({ x_en: e.from_label_en, x_ar: e.from_label_ar }, 'x')} conds={condText(e)} />
                  ))}
                </div>
              )}
              {role.regulated && routes.length > 0 && <p className="text-[12.5px] text-ink-3">{t('m01.role.eligibilityNote')}</p>}
            </Section>
          )}

          <Section title={t('m01.role.progression')} description={t('m01.role.progressionDesc')}>
            {next.length === 0 && prev.length === 0 ? (
              <EmptyState title={t('m01.role.noEdges')} />
            ) : (
              <Grid cols={2}>
                <Card title={t('m01.role.nextRoles')}>
                  {next.length === 0 ? (
                    <p className="text-ink-2">{t('m01.role.noNext')}</p>
                  ) : (
                    <div className="space-y-2" data-testid="m01-next-roles">
                      {next.map((e) => (
                        <EdgeCard key={e.id} edge={e} to={data.roleById.get(e.to_role_id)} conds={condText(e)} />
                      ))}
                    </div>
                  )}
                </Card>
                <Card title={t('m01.role.prevRoles')}>
                  {prev.length === 0 ? (
                    <p className="text-ink-2">{t('m01.role.noPrev')}</p>
                  ) : (
                    <div className="space-y-2">
                      {prev.map((e) => (
                        <EdgeCard key={e.id} edge={e} to={data.roleById.get(e.from_role_id!)} conds={condText(e)} />
                      ))}
                    </div>
                  )}
                </Card>
              </Grid>
            )}
          </Section>

          <Section title={t('m01.role.competencies')} description={t('m01.role.competenciesDesc')}>
            <Async state={extra} empty={<EmptyState title={t('m01.role.noCompetencies')} />} isEmpty={(x) => x.rc.length === 0}>
              {(x) => (
                <div className="card overflow-x-auto p-0">
                  <table className="table-base w-full" data-testid="m01-role-competencies">
                    <thead>
                      <tr>
                        <th className="text-start">{t('m01.role.competency')}</th>
                        <th className="text-start">{t('m01.role.domain')}</th>
                        <th className="text-start">{t('m01.role.requiredLevel')}</th>
                        <th className="text-start">{t('m01.role.importance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {x.rc.map((r) => {
                        const c = x.compById.get(r.competency_id);
                        const lv = x.levels.find((l) => l.level === r.required_level);
                        return (
                          <tr key={r.id}>
                            <td>
                              <span className="num me-1.5 text-ink-3">{c?.code}</span>
                              {pick(c, 'name')}
                            </td>
                            <td className="text-ink-2">{pick(c, 'domain')}</td>
                            <td>
                              <span className="num">{f.num(r.required_level)}</span> · {pick(lv, 'name')}
                            </td>
                            <td>
                              <StatusPill tone={r.importance === 'core' ? 'accent' : 'neutral'}>{t(`m01.importance.${r.importance}`)}</StatusPill>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Async>
            <p className="text-[12.5px]">
              <L to="/competencies">{t('m01.role.seeLibrary')}</L> · <L to="/future">{t('m01.role.futureSkills')}</L>
            </p>
          </Section>

          <Async state={extra} empty={null} isEmpty={(x) => x.stds.length === 0}>
            {(x) => (
              <Section title={t('m01.role.standards')} description={t('m01.role.standardsDesc')}>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m01-role-standards">
                  {x.stds.map((s) => (
                    <li key={s.id} className="card p-3">
                      <div className="caps">
                        {s.code} · v{s.version}
                      </div>
                      <div className="font-semibold">{pick(s, 'title')}</div>
                      <div className="text-[12.5px] text-ink-2">{s.requal_months ? t('m01.role.requalEvery', { n: f.num(s.requal_months) }) : t('m01.role.noRequal')}</div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </Async>

          <Card title={t('m01.sources')} footer={t('m01.role.noIncumbent')}>
            <RoleSources role={role} data={data} />
          </Card>
              </div>
            ),
          },
          { id: 'horizons', label: t('m01.fs05.tab'), content: <RoleHorizonsTab role={role} data={data} /> },
        ]}
      />
    </Page>
  );
}

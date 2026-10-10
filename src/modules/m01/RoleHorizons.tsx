// FS05 (wave A · E4) role page additions: the "Now, 2030, 2035" tab of a current role and the page of a concept future role
// (profile, inbound "future" edges, no vacancy and no deployment decision). Public: shows published versions only (RLS).
import { Page, Section, Card, Grid, Async, Icon, StatusPill } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L } from '../../i18n';
import { useCrumbLabel } from '../../shell/crumbs';
import { EdgeCard, RoleBadges, RoleSources, useConditionText, type CareerData, type Role } from './shared';
import { ConceptBanner, HorizonPanel, useProfileData } from './horizons';

export function RoleHorizonsTab({ role, data }: { role: Role; data: CareerData }) {
  const t = useT();
  const q = useProfileData();
  const condText = useConditionText();
  const leadsTo = data.futurePaths.filter((e) => e.from_role_id === role.id);
  return (
    <div className="space-y-6">
      <Async state={q}>{(d) => <HorizonPanel roleId={role.id} pathOnly={!!role.security_sensitive} concept={false} data={d} />}</Async>
      {leadsTo.length > 0 && (
        <Section title={t('m01.fs05.leadsTo.title')} description={t('m01.fs05.leadsTo.desc')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m01-leads-to">
            {leadsTo.map((e) => (
              <EdgeCard key={e.id} edge={e} to={data.conceptById.get(e.to_role_id)} conds={condText(e)} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function ConceptRoleView({ role, data }: { role: Role; data: CareerData }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const condText = useConditionText();
  const q = useProfileData();
  useCrumbLabel(pick(role, 'title'));
  const fam = data.familyById.get(role.family_id);
  const fr = useQuery(['future_roles', 'adv_technologies'], async () => {
    const [rows, techs] = await Promise.all([repo.list('future_roles', { filter: { id: role.id } }), repo.list('adv_technologies')]);
    return { row: rows[0] ?? null, techById: new Map(techs.map((x) => [x.id, x])) };
  }, [role.id]);
  const inbound = data.futurePaths.filter((e) => e.to_role_id === role.id);
  const dalilQ = encodeURIComponent(t('m01.role.askQuestion', { role: pick(role, 'title') }));
  return (
    <Page
      title={pick(role, 'title')}
      eyebrow={`${pick(fam, 'name')} · ${t('m01.fs05.concept.pill')}`}
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
      <ConceptBanner />
      <RoleBadges role={role} />
      <Grid cols={2}>
        <Card title={t('m01.fs05.concept.about')}>
          <p className="text-[14px]">{pick(role, 'summary')}</p>
          <Async state={fr} empty={null} isEmpty={(x) => !x.row}>
            {(x) => (
              <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid="m01-concept-meta">
                <StatusPill tone="info">{t(`m01.fs05.frHorizon.${x.row!.horizon}`)}</StatusPill>
                {x.row!.tech_ids.map((id) => (
                  <StatusPill key={id} tone="neutral">
                    {pick(x.techById.get(id), 'family') || id}
                  </StatusPill>
                ))}
                <L to="/future" className="ms-1 text-[12.5px]">
                  {t('m01.fs05.concept.seeFuture')}
                </L>
              </div>
            )}
          </Async>
        </Card>
        <Card title={t('m01.fs05.concept.qualTitle')}>
          <p className="text-[14px]">{pick(role, 'qualifications')}</p>
          <p className="mt-2 text-[13px] text-ink-2">{pick(role, 'training_path')}</p>
        </Card>
      </Grid>
      <Section title={t('m01.fs05.concept.howTitle')} description={t('m01.fs05.concept.howDesc')}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m01-inbound-future">
          {inbound.map((e) => (
            <EdgeCard key={e.id} edge={e} to={data.roleById.get(e.from_role_id!)} conds={condText(e)} />
          ))}
        </div>
      </Section>
      <Section title={t('m01.fs05.concept.profileTitle')} description={t('m01.fs05.concept.profileDesc')}>
        <Async state={q}>{(d) => <HorizonPanel roleId={role.id} pathOnly={false} concept data={d} />}</Async>
      </Section>
      <Card title={t('m01.sources')} footer={t('m01.role.noIncumbent')}>
        <RoleSources role={role} data={data} />
      </Card>
    </Page>
  );
}

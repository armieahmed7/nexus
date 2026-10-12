// M09 /partner: home for supplier, university and international partner users. Shows only the caller's own organisation
// (the repository applies row-level security; a partner never sees another partner's file).
import { Page, Section, Card, Callout, Async, EmptyState, Grid, StatTile, ProgressRing, SimChip, Icon } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { readinessState, icvCheck } from '../../domain/partners';
import { MStatus, useMyOrg } from './shared';

export default function PartnerPage() {
  const t = useT();
  const pick = usePick();
  const s = useSession();
  const { org, orgId, loading } = useMyOrg();
  return (
    <Page title={t('m09.routes.partner.title')} eyebrow={org ? pick(org, 'name') : t('m09.home.eyebrow')} intro={t('m09.home.intro')}>
      {!orgId && !loading ? (
        <EmptyState title={t('m09.home.noOrg')}>{t('m09.home.noOrgBody')}</EmptyState>
      ) : s.roles.includes('university') && !s.roles.includes('partner_user') && !s.roles.includes('partner_admin') ? (
        <UniversityHome />
      ) : org?.kind === 'international' ? (
        <InternationalHome />
      ) : (
        <SupplierHome />
      )}
    </Page>
  );
}

function SupplierHome() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const { orgId, org, isAdmin, personId } = useMyOrg();
  const q = useQuery(['partner_onboarding', 'supplier_readiness', 'supplier_documents', 'icv_plans', 'enrolments', 'certificates', 'equivalency_requests', 'courses'], async () => {
    const [cases, steps, docs, icv, enrol, certs, eq, courses] = await Promise.all([
      repo.list('partner_onboarding', { filter: { org_id: orgId ?? '' } }),
      repo.list('supplier_readiness', { filter: { org_id: orgId ?? '' } }),
      repo.list('supplier_documents', { filter: { org_id: orgId ?? '' } }),
      repo.list('icv_plans', { filter: { org_id: orgId ?? '' } }),
      repo.list('enrolments', { filter: { person_id: personId ?? '' } }),
      repo.list('certificates', { filter: { person_id: personId ?? '' } }),
      repo.list('equivalency_requests', { filter: { org_id: orgId ?? '' } }),
      repo.list('courses', { filter: { audience: 'supplier' } }),
    ]);
    return { c: cases[0] ?? null, steps, docs, icv: icv[0] ?? null, enrol: enrol.filter((e) => courses.some((c) => c.id === e.course_id)), certs, eq, courses };
  }, [orgId, personId]);
  return (
    <Async state={q} isEmpty={() => false}>
      {(d) => {
        const st = readinessState(d.steps, d.docs, d.icv);
        const icv = d.icv ? icvCheck(d.icv) : null;
        const done = d.enrol.filter((e) => e.status === 'completed').length;
        const openEq = d.eq.filter((e) => ['submitted', 'under_review'].includes(e.status)).length;
        const next: { key: string; to: string; vars?: Record<string, string | number> }[] = [];
        if (d.c?.status === 'invited') next.push({ key: 'start', to: '/partner/onboarding' });
        if (d.c && ['in_progress', 'returned'].includes(d.c.status)) {
          if (st.missingSteps.length) next.push({ key: 'steps', to: '/partner/onboarding', vars: { n: st.missingSteps.length } });
          if (st.missingDocs.length || st.rejectedDocs.length) next.push({ key: 'docs', to: '/partner/onboarding?tab=documents', vars: { n: st.missingDocs.length + st.rejectedDocs.length } });
          if (!st.icvReady) next.push({ key: 'icv', to: '/partner/icv' });
          if (st.ready) next.push({ key: 'submit', to: '/partner/onboarding' });
        }
        if (d.c?.status === 'returned') next.unshift({ key: 'returned', to: '/partner/onboarding?tab=status' });
        if (icv && (icv.certificate === 'expiring' || icv.certificate === 'expired')) next.push({ key: `cert_${icv.certificate}`, to: '/partner/icv', vars: { n: icv.daysToCertExpiry ?? 0 } });
        if (d.courses.length > done) next.push({ key: 'academy', to: '/partner/academy', vars: { n: d.courses.length - done } });
        return (
          <>
            {d.c?.status === 'handed_off' && <Callout tone="ok" title={t('m09.home.handedTitle')}>{t('m09.home.handedBody')}</Callout>}
            <Grid cols={4}>
              <Card>
                <div className="flex items-center gap-3">
                  <ProgressRing value={d.c?.status === 'handed_off' || d.c?.status === 'approved' ? 100 : st.pct} label={`${f.num(d.c?.status === 'handed_off' || d.c?.status === 'approved' ? 100 : st.pct)}%`} />
                  <div>
                    <div className="caps">{t('m09.home.readiness')}</div>
                    {d.c ? <MStatus status={d.c.status} /> : <span className="text-ink-3">{t('m09.home.noCase')}</span>}
                  </div>
                </div>
                <L to="/partner/onboarding" className="mt-3 inline-block text-[13px]" data-testid="m09-home-onboarding">{t('m09.home.openOnboarding')}</L>
              </Card>
              <StatTile label={t('m09.home.docs')} value={`${f.num(st.docsReady)} / ${f.num(st.docsRequired)}`} sub={st.rejectedDocs.length ? t('m09.home.docsRejected', { n: f.num(st.rejectedDocs.length) }) : t('m09.home.docsSub')} tone={st.rejectedDocs.length ? 'bad' : undefined} />
              <StatTile label={t('m09.home.icv')} value={d.icv ? `${f.num(d.icv.baseline)} → ${f.num(d.icv.target)}` : '—'} sub={d.icv ? <MStatus status={d.icv.status} /> : t('m09.home.icvNone')} sim />
              <StatTile label={t('m09.home.academy')} value={`${f.num(done)} / ${f.num(d.courses.length)}`} sub={t('m09.home.certs', { n: f.num(d.certs.length) })} />
            </Grid>

            <Grid cols={2}>
              <Card title={t('m09.home.nextTitle')}>
                {next.length === 0 ? (
                  <p className="text-ink-2">{t('m09.home.nextNone')}</p>
                ) : (
                  <ul className="space-y-2" data-testid="m09-home-next">
                    {next.map((n) => (
                      <li key={n.key}>
                        <L to={n.to} className="flex items-center justify-between gap-2 rounded-btn border border-line p-2.5 hover:border-accent">
                          <span>{t(`m09.home.next.${n.key}`, n.vars)}</span>
                          <Icon name="chevron" size={14} />
                        </L>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title={t('m09.home.orgTitle')} footer={org?.synthetic ? <span className="flex items-center gap-2"><SimChip label={t('m09.home.synthetic')} />{t('m09.home.syntheticBody')}</span> : null}>
                <dl className="space-y-1 text-[13.5px]">
                  <div><dt className="caps inline">{t('m09.home.orgName')}: </dt><dd className="inline">{org ? pick(org, 'name') : '—'}</dd></div>
                  <div><dt className="caps inline">{t('m09.home.orgScope')}: </dt><dd className="inline">{org ? pick(org, 'relationship') : '—'}</dd></div>
                  <div><dt className="caps inline">{t('m09.home.yourRole')}: </dt><dd className="inline">{isAdmin ? t('m09.home.roleAdmin') : t('m09.home.roleUser')}</dd></div>
                  {isAdmin && <div><dt className="caps inline">{t('m09.home.equivalency')}: </dt><dd className="inline num">{t('m09.home.eqOpen', { n: f.num(openEq), total: f.num(d.eq.length) })}</dd></div>}
                </dl>
              </Card>
            </Grid>

            <Section title={t('m09.home.linksTitle')}>
              <Grid cols={4}>
                {[
                  ['onboarding', '/partner/onboarding', 'check'],
                  ['academy', '/partner/academy', 'grad'],
                  ...(isAdmin ? [['workforce', '/partner/workforce', 'users']] : []),
                  ['icv', '/partner/icv', 'chart'],
                  ['regional', '/ecosystem/regional-plan', 'globe'], // FS64 (wave G integration)
                  [isAdmin ? 'pledgesRegister' : 'pledges', isAdmin ? '/ecosystem/pledges/register' : '/ecosystem/pledges', 'sparkle'], // FS65 (wave G integration)
                ].map(([k, to, icon]) => (
                  <L key={k} to={to} className="card flex items-start gap-3 p-4 hover:border-accent" data-testid={`m09-home-link-${k}`}>
                    <Icon name={icon} size={20} className="text-accent" />
                    <div>
                      <div className="font-semibold">{t(`m09.home.link.${k}.title`)}</div>
                      <p className="text-[12.5px] text-ink-2">{t(`m09.home.link.${k}.body`)}</p>
                    </div>
                  </L>
                ))}
              </Grid>
            </Section>
            <p className="text-[12.5px] text-ink-3">{t('m09.home.isolation')}</p>
          </>
        );
      }}
    </Async>
  );
}

function UniversityHome() {
  const t = useT();
  return (
    <>
      <Callout tone="info" title={t('m09.home.uniTitle')}>{t('m09.home.uniBody')}</Callout>
      <Grid cols={3}>
        {[['university', '/partner/university'], ['research', '/partner/research'], ['public', '/universities'], ['regional', '/ecosystem/regional-plan'], ['pledges', '/ecosystem/pledges/register']].map(([k, to]) => ( // FS64/FS65 entry points (wave G integration)
          <L key={k} to={to} className="card p-4 hover:border-accent">
            <div className="font-semibold">{t(`m09.home.uni.${k}.title`)}</div>
            <p className="text-[12.5px] text-ink-2">{t(`m09.home.uni.${k}.body`)}</p>
          </L>
        ))}
      </Grid>
    </>
  );
}

function InternationalHome() {
  const t = useT();
  const repo = useRepo();
  const { orgId } = useMyOrg();
  const q = useQuery('partner_onboarding', () => repo.list('partner_onboarding', { filter: { org_id: orgId ?? '' } }), [orgId]);
  return (
    <>
      <Callout tone="info" title={t('m09.home.intlTitle')}>{t('m09.home.intlBody')}</Callout>
      <Async state={q} isEmpty={() => false}>
        {(cases) => (
          <Card title={t('m09.home.intlCase')}>
            {cases[0] ? <MStatus status={cases[0].status} /> : <span className="text-ink-3">{t('m09.home.noCase')}</span>}
          </Card>
        )}
      </Async>
      <Grid cols={3}>
        {[['directory', '/partners'], ['future', '/future'], ['academy', '/partner/academy']].map(([k, to]) => (
          <L key={k} to={to} className="card p-4 hover:border-accent">
            <div className="font-semibold">{t(`m09.home.intl.${k}.title`)}</div>
            <p className="text-[12.5px] text-ink-2">{t(`m09.home.intl.${k}.body`)}</p>
          </L>
        ))}
      </Grid>
    </>
  );
}

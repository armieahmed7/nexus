// FS68 Supplier future-skills readiness. Two routes share this page:
//   /partner/workforce/future-readiness   partner admins and users (partner_org OwnOrg): their own organisation only
//   /admin/suppliers/future-readiness     ENEC supplier management, evaluators and auditors: every supplier organisation
// Contractor coverage of the 2030 versions of the contracted ENEC role profiles, grouped as digital, AI literacy, cyber hygiene and
// other future skills; organisations with fewer than 10 contractors show "suppressed"; course suggestions carry F33 engine reasons.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Grid, StatTile, Callout, Async, EmptyState, ProgressRing, WhyThis, BenchmarkChips, Tabs, KeyValue } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, useFormat, L } from '../../i18n';
import { FR_GROUPS, type FrOrg, type FrReport } from './futureReadiness';
import { GroupTile, ReqRow, useBi } from './fs75ui';
import { NotAuthority } from './passportUi';

function OrgView({ o, partner }: { o: FrOrg; partner: boolean }) {
  const t = useT();
  const f = useFormat();
  const bi = useBi();
  return (
    <div className="space-y-5" data-testid="m09-fr-org" data-org={o.org_id} data-suppressed={o.suppressed ? 'yes' : 'no'}>
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          {o.suppressed ? <span className="chip border-sim-line bg-sim-bg text-sim" data-testid="m09-fr-suppressed">{t('common.suppressed')}</span>
            : <ProgressRing value={o.future_pct ?? 0} size={76} tone={(o.future_pct ?? 0) >= 60 ? 'ok' : 'accent'} label={t('m09.fr.ringLabel')} />}
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold">{bi(o.name)}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">
              {o.suppressed ? t('m09.fr.suppressedBody') : t('m09.fr.orgLine', { n: f.num(o.n), pct: f.pct(o.future_pct, 0), roles: f.num(o.roles.length) })}
            </p>
          </div>
          {partner && <L to="/partner/workforce/passport" className="btn-ghost">{t('m09.fr.toMatrix')}</L>}
        </div>
      </Card>
      <Grid cols={4}>
        {FR_GROUPS.map((g) => { const x = o.groups.find((y) => y.group === g)!; return <GroupTile key={g} group={g} reqs={x.reqs} pct={x.pct} bridge={x.bridge_pct} suppressed={o.suppressed} />; })}
      </Grid>
      {o.roles.map((r) => (
        <Card key={r.role_id} padded={false} title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{bi(r.title)}</span>
            <span className="chip border-line bg-sunken text-ink-2">{t('m09.fr.band', { band: r.band })}</span>
            {r.version != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.fr.profileVersion', { v: f.num(r.version) })}</span>}
          </span>
        } actions={<WhyThis reasons={r.reasons as never} testId="m09-fr-role-why" />}>
          <div className="space-y-2 px-4 pt-3" data-testid="m09-fr-role" data-role={r.role_id}>
            <KeyValue items={[
              [t('m09.fr.today'), r.today_pct == null ? t('common.suppressedShort') : t('m09.fr.todayVal', { pct: f.pct(r.today_pct, 0), n: f.num(r.today_total) })],
              [t('m09.fr.future'), r.future_pct == null ? t('common.suppressedShort') : t('m09.fr.futureVal', { pct: f.pct(r.future_pct, 0), bridge: f.pct(r.bridge_pct, 0), n: f.num(r.future.length) })],
            ]} />
            <L to={`/careers/roles/${r.role_id}`} className="text-[12.5px] text-accent underline-offset-2 hover:underline">{t('m09.fr.toProfile')}</L>
          </div>
          {!r.future.length ? <p className="px-4 py-3 text-[12.5px] text-ink-3">{t('m09.fr.noFuture')}</p> : (
            <ul className="mt-2 divide-y divide-line border-t border-line" data-testid="m09-fr-reqs">{r.future.map((x) => <ReqRow key={`${x.kind}:${x.ref_id}`} r={x} suppressed={o.suppressed} />)}</ul>
          )}
        </Card>
      ))}
      <Section title={t('m09.fr.suggestTitle')} description={t('m09.fr.suggestDesc')}>
        <Card footer={t('m09.cp.pcSuggestNote')}>
          {!o.suggestions.length ? <p className="text-[12.5px] text-ink-3">{t('m09.fr.noSuggest')}</p> : (
            <ul className="space-y-2" data-testid="m09-fr-suggestions">
              {o.suggestions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2" data-testid="m09-fr-suggestion">
                  <span className="min-w-0">
                    <span className="font-medium">{s.code} · {bi(s.title)}</span>{' '}
                    {s.audience === 'supplier' ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('m09.cp.academyChip')}</span> : <span className="chip border-line bg-sunken text-ink-2">{t('m09.cp.enecChip')}</span>}
                    {s.hours != null && <span className="ms-2 text-[12px] text-ink-3">{t('m09.fr.hours', { h: f.num(s.hours) })}</span>}
                  </span>
                  <WhyThis reasons={s.reasons as never} testId="m09-fr-sug-why" />
                </li>
              ))}
            </ul>
          )}
        </Card>
        {o.academy_gaps.length > 0 && (
          <Callout tone="sim" title={t('m09.fr.gapsTitle')}>
            <span data-testid="m09-fr-academy-gaps">{t('m09.fr.gapsBody', { skills: o.academy_gaps.map((g) => bi(g.name)).join(', ') })}</span>
          </Callout>
        )}
      </Section>
    </div>
  );
}

export default function FutureReadinessPage() {
  const t = useT();
  const f = useFormat();
  const bi = useBi();
  const repo = useRepo();
  const q = useQuery(['person_skills', 'contract_role_targets', 'role_profile_versions'], () => repo.rpc.supplierFutureReadiness(), []);
  const [tab, setTab] = useState<string | undefined>(undefined);
  const partner = q.data?.scope === 'own';
  const totals = useMemo(() => {
    const d = q.data as FrReport | undefined;
    const shown = (d?.orgs ?? []).filter((o) => !o.suppressed);
    return { orgs: d?.orgs.length ?? 0, shown: shown.length, roles: (d?.orgs ?? []).reduce((a, o) => a + o.roles.length, 0), contractors: shown.reduce((a, o) => a + (o.n ?? 0), 0) };
  }, [q.data]);
  return (
    <Page title={t(partner ? 'm09.routes.partner-future-readiness.title' : 'm09.routes.admin-supplier-future-readiness.title')} intro={t('m09.fr.intro')} wide
      actions={partner ? <L to="/partner/workforce/passport" className="btn-ghost">{t('m09.cp.back')}</L> : <L to="/admin/suppliers" className="btn-ghost">{t('m09.fr.backSuppliers')}</L>}>
      <BenchmarkChips feature="FS68" />
      <NotAuthority />
      <Async state={q} isEmpty={(d) => !d.allowed || d.orgs.length === 0} empty={<EmptyState title={t('m09.fr.emptyTitle')}>{t('m09.fr.emptyBody')}</EmptyState>}>
        {(d) => (
          <div className="space-y-6">
            {d.scope === 'all' && (
              <Grid cols={4}>
                <StatTile label={t('m09.fr.tOrgs')} value={f.num(totals.orgs)} sub={t('m09.fr.tOrgsSub', { n: f.num(totals.orgs - totals.shown) })} />
                <StatTile label={t('m09.fr.tRoles')} value={f.num(totals.roles)} />
                <StatTile label={t('m09.fr.tContractors')} value={f.num(totals.contractors)} sub={t('m09.fr.tContractorsSub')} />
                <StatTile label={t('m09.fr.tMin')} value={f.num(d.min_group)} sub={t('m09.fr.tMinSub')} />
              </Grid>
            )}
            {d.orgs.length === 1 ? <OrgView o={d.orgs[0]} partner={partner} />
              : <Tabs value={tab ?? d.orgs[0].org_id} onChange={setTab} tabs={d.orgs.map((o) => ({ id: o.org_id, label: bi(o.name), content: <OrgView o={o} partner={false} /> }))} />}
            <Card title={t('m09.fr.methodTitle')}>
              <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2" data-testid="m09-fr-method">
                <li>{t('m09.fr.m1')}</li><li>{t('m09.fr.m2')}</li><li>{t('m09.fr.m3')}</li><li>{t('m09.fr.m4')}</li><li>{t('m09.fr.m5')}</li>
              </ul>
            </Card>
          </div>
        )}
      </Async>
    </Page>
  );
}

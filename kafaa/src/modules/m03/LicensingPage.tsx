// M03 /licensing (public): how RO and SRO certification works under FANR-REG-17 (in force 30 May 2024): who does what,
// the stages, the three RO and three SRO entry routes with article references, what the certificate requires, and a
// general eligibility explainer (routeChecks). Eligibility is determined by ENEC and FANR; Kafa'a is not an authority.
import { useState } from 'react';
import { Page, Section, Card, Grid, Async, Callout, StatusPill, SourceLink, StatTile, Timeline, TextField, CheckboxField, Icon } from '../../ui';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useT, usePick, useFormat, L, useRefText } from '../../i18n';
import { routeChecks, type ExperienceInput } from '../../domain/rules';
import { REG17_RULES } from './licensing';

type Route = { id: string; en: string; ar: string; rule_ref?: string; url?: string };

export default function LicensingPage() {
  const t = useT();
  const repo = useRepo();
  const q = useQuery(['job_roles', 'sources'], async () => {
    const [roles, sources] = await Promise.all([repo.list('job_roles', { filter: { id: ['reactor-operator', 'senior-reactor-operator', 'local-operator'] } }), repo.list('sources', { filter: { id: ['fanr-reg17', 'cns10', 'sr2024'] } })]);
    return { roles: new Map(roles.map((r) => [r.id, r])), src: new Map(sources.map((s) => [s.id, s])) };
  });
  return (
    <Page title={t('m03.routes.licensing.title')} eyebrow={t('m03.pub.eyebrow')} intro={t('m03.pub.intro')}>
      <Async state={q}>{(d) => <Explainer d={d} />}</Async>
    </Page>
  );
}

function Explainer({ d }: { d: { roles: Map<string, RowOf<'job_roles'>>; src: Map<string, RowOf<'sources'>> } }) {
  const t = useT();
  const pick = usePick();
  const refText = useRefText();
  const f = useFormat();
  const reg = d.src.get('fanr-reg17');
  const cns = d.src.get('cns10');
  const routes = (id: string) => ((d.roles.get(id)?.entry_routes as Route[]) ?? []).filter((r) => r.id !== 'clearance');
  return (
    <>
      <Callout tone="info" title={t('m03.pub.notAuthorityTitle')}>
        {t('m03.pub.notAuthorityBody')}
      </Callout>
      <Grid cols={3}>
        <Card title={t('m03.pub.whoFanr')} eyebrow="FANR">
          <p className="text-[13.5px]">{t('m03.pub.whoFanrBody')}</p>
        </Card>
        <Card title={t('m03.pub.whoEnec')} eyebrow="ENEC Operations">
          <p className="text-[13.5px]">{t('m03.pub.whoEnecBody')}</p>
        </Card>
        <Card title={t('m03.pub.whoKafaa')} eyebrow="Kafa'a">
          <p className="text-[13.5px]">{t('m03.pub.whoKafaaBody')}</p>
        </Card>
      </Grid>

      <Section title={t('m03.pub.stagesTitle')}>
        <Card>
          <Timeline
            items={['s1', 's2', 's3', 's4', 's5', 's6'].map((s, i) => ({ id: s, when: t('m03.pub.step', { n: f.num(i + 1) }), title: t(`m03.pub.${s}Title`), detail: t(`m03.pub.${s}Body`), tone: i < 5 ? 'accent' : 'ok' }))}
          />
        </Card>
      </Section>

      <Section title={t('m03.pub.routesTitle')} description={t('m03.pub.routesDesc')}>
        <Grid cols={2}>
          {(['reactor-operator', 'senior-reactor-operator'] as const).map((rid) => (
            <Card key={rid} title={<L to={`/careers/roles/${rid}`}>{pick(d.roles.get(rid), 'title')}</L>} eyebrow={t('m03.pub.anyOne')}>
              <ol className="space-y-2" data-testid={`m03-routes-${rid}`}>
                {routes(rid).map((r, i) => (
                  <li key={r.id} className="rounded-btn border border-line p-2.5 text-[13.5px]">
                    <div className="caps mb-0.5">{t('m01.role.routeN', { n: i + 1 })}</div>
                    {pick({ x_en: r.en, x_ar: r.ar }, 'x')}
                    {r.rule_ref && <div className="mt-1">{r.url ? <SourceLink href={r.url}>{refText(r.rule_ref)}</SourceLink> : refText(r.rule_ref)}</div>}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[12.5px] text-ink-2">{t('m03.pub.clearance')}</p>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section title={t('m03.pub.rulesTitle')} description={t('m03.pub.rulesDesc')}>
        <div className="card overflow-x-auto p-0" tabIndex={0}>
          <table className="table-base w-full min-w-[720px]" data-testid="m03-rules">
            <thead>
              <tr>
                <th className="text-start">{t('m03.pub.rule')}</th>
                <th className="text-start">{t('m03.pub.requirement')}</th>
                <th className="text-start">{t('m03.pub.tracker')}</th>
              </tr>
            </thead>
            <tbody>
              {REG17_RULES.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="align-top text-start">
                    {t(`m03.rules.${r.id}.name`)}
                    <div className="text-[12px] font-normal text-ink-3">{r.article}</div>
                  </th>
                  <td className="align-top text-[13.5px]">{t(`m03.rules.${r.id}.req`, r.params as Record<string, number>)}</td>
                  <td className="align-top text-[13.5px] text-ink-2">{t(`m03.rules.${r.id}.tracker`, r.params as Record<string, number>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Eligibility />

      <Grid cols={2}>
        <StatTile label={t('m03.pub.statCerts')} value={t('m03.pub.statCertsValue')} sub={t('m03.pub.statCertsSub')} source={cns && <SourceLink href={cns.url} date={cns.accessed}>{cns.label}</SourceLink>} />
        <Card title={t('m01.sources')}>
          <ul className="space-y-1">
            {[reg, cns, d.src.get('sr2024')].filter(Boolean).map((s) => (
              <li key={s!.id}>
                <SourceLink href={s!.url} date={s!.accessed}>
                  {s!.label}
                </SourceLink>
              </li>
            ))}
          </ul>
        </Card>
      </Grid>
    </>
  );
}

const ZERO: Record<keyof ExperienceInput, string> = { highSchool: 'true', bsc: '', monthsQualifiedLO: '0', monthsROatBarakah: '0', monthsRoSroElsewhere: '0', monthsFossilOrOther: '0', monthsAtBarakah: '0', monthsOnCrewAtBarakah: '0', monthsNuclearAtBarakah: '0', monthsAsLOatBarakah: '0' };

function Eligibility() {
  const t = useT();
  const refText = useRefText();
  const [v, setV] = useState(ZERO);
  const num = (k: keyof ExperienceInput) => Math.max(0, Math.min(600, Number(v[k]) || 0));
  const input: ExperienceInput = {
    highSchool: v.highSchool === 'true', bsc: v.bsc === 'true', monthsQualifiedLO: num('monthsQualifiedLO'), monthsROatBarakah: num('monthsROatBarakah'), monthsRoSroElsewhere: num('monthsRoSroElsewhere'),
    monthsFossilOrOther: num('monthsFossilOrOther'), monthsAtBarakah: num('monthsAtBarakah'), monthsOnCrewAtBarakah: num('monthsOnCrewAtBarakah'), monthsNuclearAtBarakah: num('monthsNuclearAtBarakah'), monthsAsLOatBarakah: num('monthsAsLOatBarakah'),
  };
  const checks = routeChecks(input);
  const months: (keyof ExperienceInput)[] = ['monthsQualifiedLO', 'monthsROatBarakah', 'monthsAsLOatBarakah', 'monthsNuclearAtBarakah', 'monthsAtBarakah', 'monthsOnCrewAtBarakah', 'monthsRoSroElsewhere', 'monthsFossilOrOther'];
  return (
    <Section title={t('m03.elig.title')} description={t('m03.elig.desc')}>
      <Callout tone="sim" title={t('m03.elig.disclaimerTitle')}>
        {t('m03.elig.disclaimer')}
      </Callout>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card title={t('m03.elig.yourExperience')}>
          <div className="space-y-2" data-testid="m03-elig-form">
            <CheckboxField label={t('m03.elig.highSchool')} checked={v.highSchool === 'true'} onChange={(x) => setV({ ...v, highSchool: x ? 'true' : '' })} />
            <CheckboxField label={t('m03.elig.bsc')} checked={v.bsc === 'true'} onChange={(x) => setV({ ...v, bsc: x ? 'true' : '' })} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {months.map((k) => (
                <TextField key={k} type="number" label={t(`m03.elig.${k}`)} name={k} value={v[k]} onChange={(x) => setV({ ...v, [k]: x })} />
              ))}
            </div>
            <button className="btn-ghost btn-sm" onClick={() => setV(ZERO)}>
              {t('m03.elig.reset')}
            </button>
          </div>
        </Card>
        <div className="space-y-2" aria-live="polite" data-testid="m03-elig-result">
          {checks.map((c) => {
            const ok = c.met.every((m) => m.ok);
            return (
              <div key={c.route} className={`rounded-card border p-3 ${ok ? 'border-ok-line bg-ok-bg' : 'border-line bg-panel'}`} data-status={ok ? 'met' : 'open'}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {t(`m03.route.${c.route}`)} <span className="text-[12px] font-normal text-ink-3">({refText(c.ruleRef)})</span>
                  </div>
                  <StatusPill tone={ok ? 'ok' : 'neutral'}>{ok ? t('m03.elig.allMet') : t('m03.elig.open', { n: c.met.filter((m) => !m.ok).length })}</StatusPill>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-[13px]">
                  {c.met.map((m, i) => (
                    <li key={i} className="flex gap-1.5">
                      <Icon name={m.ok ? 'check' : 'close'} size={13} className={`mt-0.5 shrink-0 ${m.ok ? 'text-ok' : 'text-ink-3'}`} />
                      {t(`m03.elig.req.${c.route}.${i}`)}
                    </li>
                  ))}
                  <li className="flex gap-1.5 text-ink-2">
                    <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
                    {t('m03.elig.plusClearance')}
                  </li>
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

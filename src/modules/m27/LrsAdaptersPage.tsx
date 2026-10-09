// M27 /training/lrs/adapters (F30): how an external learning record store would connect (SIMULATED). The Kafa'a store has no
// public endpoint in the demo; this page documents the xAPI 2.0 Statement API a connector would use, the field mapping, the
// Kafa'a profile (verbs, activity types, rules), the emitter registry and the SIMULATED outbound connector (/admin/integrations).
import { useMemo } from 'react';
import { Page, Section, Card, Grid, Async, SimChip, SourceLink, StatusPill, Stepper, Callout, KeyValue } from '../../ui';
import { useT, useFormat, L } from '../../i18n';
import { useQuery, useRepo } from '../../data';
import { ACTIVITY_BASE, ACTIVITY_TYPE_IRI, EXT, OBJECT_TYPES, VERBS, VERB_IRI, XAPI_HOME, XAPI_VERSION, toXapi, xapiId } from './xapi';
import { EmittersTable, LrsMirrorNote, VerbChip } from './lrsUi';

const ENDPOINT = 'https://lrs.example/xapi/';
const STEPS = ['emit', 'validate', 'store', 'forward'] as const;
const API = [
  { method: 'POST', path: 'statements', key: 'post' },
  { method: 'PUT', path: 'statements?statementId={id}', key: 'put' },
  { method: 'GET', path: 'statements?agent=…&verb=…&activity=…&since=…', key: 'get' },
  { method: 'GET', path: 'about', key: 'about' },
] as const;
const MAP: [string, string][] = [
  ['id', 'id'], ['actor_person_id', 'actor.account.name'], ['verb', 'verb.id'], ['object_type + object_id', 'object.id'], ['object_name', 'object.definition.name'],
  ['result', 'result'], ['context', 'context'], ['occurred_at', 'timestamp'], ['stored_at', 'stored'], ['version', 'version'],
];

export default function LrsAdaptersPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery('integrations', async () => (await repo.list('integrations', { filter: { id: 'int-lrs' } }))[0] ?? null);
  const sample = useMemo(() => {
    const row = {
      id: xapiId('m04_course', 'tr-example'), actor_person_id: 'w-ro-01', verb: 'completed' as const, object_type: 'course' as const, object_id: 'c-get',
      object_name: { en: 'General Employee Training', ar: 'التدريب العام للموظفين' }, result: { completion: true, success: true, duration: 'PT16H' },
      context: { extensions: { [`${EXT}record`]: 'training_records/tr-example' } }, occurred_at: '2026-10-08T12:00:00Z', stored_at: '2026-10-08T12:00:00Z', version: XAPI_VERSION,
    };
    return `POST ${ENDPOINT}statements\nX-Experience-API-Version: ${XAPI_VERSION}\nContent-Type: application/json\nAuthorization: Bearer <client-credentials token>\n\n${JSON.stringify(toXapi(row), null, 2)}`;
  }, []);
  return (
    <Page title={t('m27.routes.training-lrs-adapters.title')} eyebrow={t('m27.common.eyebrow')} intro={t('m27.ad.intro')} actions={<SimChip label={t('m27.ad.simulated')} />} wide>
      <Callout tone="sim" title={t('m27.ad.noEndpointTitle')}>{t('m27.ad.noEndpoint')}</Callout>
      <Section title={t('m27.ad.flowTitle')}>
        <Card>
          <Stepper steps={STEPS.map((s) => ({ id: s, label: t(`m27.ad.step.${s}`) }))} current={3} />
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s} className="rounded-card border border-line p-3">
                <div className="caps">{f.num(i + 1)} · {t(`m27.ad.step.${s}`)}</div>
                <p className="mt-1 text-[13px] text-ink-2">{t(`m27.ad.stepBody.${s}`)}</p>
              </div>
            ))}
          </div>
        </Card>
      </Section>
      <Grid cols={2}>
        <Card title={t('m27.ad.connectorTitle')} actions={<SimChip />}>
          <Async state={q}>
            {(row) => (
              <div data-testid="m27-connector">
                <KeyValue
                  items={[
                    [t('m27.ad.status'), <StatusPill key="s" tone={row?.status === 'ok' ? 'ok' : 'neutral'}>{t(`m27.ad.state.${row?.status ?? 'disabled'}`)}</StatusPill>],
                    [t('m27.ad.endpoint'), <bdi key="e" dir="ltr" className="font-mono text-[12px]">{ENDPOINT}</bdi>],
                    [t('m27.ad.auth'), t('m27.ad.authValue')],
                    [t('m27.ad.version'), <bdi key="v" dir="ltr">X-Experience-API-Version: {XAPI_VERSION}</bdi>],
                    [t('m27.ad.direction'), t('m27.ad.directionValue')],
                    [t('m27.ad.records'), row ? f.num(row.records) : '—'],
                  ]}
                />
                <p className="mt-2 text-[12px] text-ink-3">{t('m27.ad.connectorNote')} <L to="/admin/integrations">{t('m27.ad.integrations')}</L></p>
              </div>
            )}
          </Async>
        </Card>
        <Card title={t('m27.ad.apiTitle')}>
          <table className="w-full text-[13px]" data-testid="m27-api">
            <tbody>
              {API.map((a) => (
                <tr key={a.key} className="border-b border-line/60 align-top">
                  <td className="py-2 pe-2"><StatusPill tone={a.method === 'GET' ? 'info' : 'accent'}>{a.method}</StatusPill></td>
                  <td className="py-2 pe-2"><bdi dir="ltr" className="font-mono text-[12px]">/xapi/{a.path}</bdi><div className="text-[12px] text-ink-3">{t(`m27.ad.api.${a.key}`)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Grid>
      <Section title={t('m27.ad.sampleTitle')} description={t('m27.ad.sampleBody')}>
        <pre dir="ltr" className="max-h-96 overflow-auto rounded-card border border-line bg-sunken p-3 text-start font-mono text-[11.5px] leading-5 text-ink-2" data-testid="m27-sample">{sample}</pre>
      </Section>
      <Grid cols={2}>
        <Card title={t('m27.ad.mapTitle')}>
          <table className="w-full text-[13px]" data-testid="m27-mapping">
            <thead><tr className="border-b border-line"><th className="caps py-2 text-start">{t('m27.ad.col.kafaa')}</th><th className="caps py-2 text-start">{t('m27.ad.col.xapi')}</th></tr></thead>
            <tbody>
              {MAP.map(([a, b]) => (
                <tr key={a} className="border-b border-line/60"><td className="py-1.5 pe-2"><bdi dir="ltr" className="font-mono text-[12px]">{a}</bdi></td><td className="py-1.5"><bdi dir="ltr" className="font-mono text-[12px]">{b}</bdi></td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-ink-3">{t('m27.ad.mapNote', { home: XAPI_HOME })}</p>
        </Card>
        <Card title={t('m27.ad.profileTitle')}>
          <ul className="list-disc space-y-1.5 ps-5 text-[13px] text-ink-2" data-testid="m27-rules">
            {['account', 'verbs', 'activities', 'response', 'secure', 'append', 'scope'].map((k) => <li key={k}>{t(`m27.ad.rule.${k}`)}</li>)}
          </ul>
        </Card>
      </Grid>
      <Grid cols={2}>
        <Card title={t('m27.ad.verbsTitle')}>
          <table className="w-full text-[13px]">
            <tbody>
              {VERBS.map((v) => <tr key={v} className="border-b border-line/60"><td className="py-1.5 pe-2"><VerbChip verb={v} /></td><td className="py-1.5"><bdi dir="ltr" className="break-all font-mono text-[11.5px] text-ink-3">{VERB_IRI[v]}</bdi></td></tr>)}
            </tbody>
          </table>
        </Card>
        <Card title={t('m27.ad.typesTitle')}>
          <table className="w-full text-[13px]">
            <tbody>
              {OBJECT_TYPES.map((o) => (
                <tr key={o} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pe-2 font-semibold">{t(`m27.type.${o}`)}</td>
                  <td className="py-1.5"><bdi dir="ltr" className="break-all font-mono text-[11.5px] text-ink-3">{ACTIVITY_BASE}{o}/…</bdi>{ACTIVITY_TYPE_IRI[o] && <div><bdi dir="ltr" className="break-all font-mono text-[11px] text-ink-3">{ACTIVITY_TYPE_IRI[o]}</bdi></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Grid>
      <Section title={t('m27.ad.emittersTitle')} description={t('m27.ad.emittersBody')}>
        <Card><EmittersTable /></Card>
      </Section>
      <Section title={t('m27.ad.sourcesTitle')}>
        <ul className="space-y-1 text-[13px]" data-testid="m27-sources">
          <li><SourceLink href="https://adlnet.gov/projects/xapi" date="2026-10-08">{t('m27.ad.src.adl')}</SourceLink></li>
          <li><SourceLink href="https://github.com/adlnet/xAPI-Spec" date="2026-10-08">{t('m27.ad.src.spec')}</SourceLink></li>
        </ul>
      </Section>
      <LrsMirrorNote />
    </Page>
  );
}

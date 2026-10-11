// F02 (wave 0) · /admin/integrations card: which engine serves each AI-flavoured surface, its weights and the model slot.
// Admins switch a surface with rpc.setEngineWeights (audited). Without VITE_KAFAA_MODEL_URL the model slot is disabled and
// a "model" request is served by the deterministic engine ("model unavailable"); nothing errors.
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useT } from '../../i18n';
import { Async, Card, DataTable, EngineBadge, type Column } from '../../ui';
import { DEFAULT_SETTINGS, SURFACES, modelGatewayUrl, resolveEngine, type Surface } from '../../domain/engines';
import { GatedConfirm } from './parts';

export function EnginesCard() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canSet = s.can('integrations', ['A']);
  const q = useQuery('engine_settings', () => repo.list('engine_settings'));
  const [pending, setPending] = useState<{ surface: Surface; engine: 'deterministic' | 'model' } | null>(null);
  const url = modelGatewayUrl();
  return (
    <Card title={t('common.engines.admin.title')} footer={<span className="text-[12px] text-ink-3">{t('common.engines.admin.gateway')}: {url ? t('common.engines.admin.gatewayConfigured') : t('common.engines.admin.gatewayDisabled')}</span>}>
      <p className="mb-3 text-[13px] text-ink-2">{t('common.engines.admin.intro')}</p>
      <Async state={q}>
        {(rows) => {
          const list = SURFACES.map((surface) => {
            const row = rows.find((r) => r.surface === surface) ?? null;
            return { surface, row, eng: resolveEngine(surface, row ?? DEFAULT_SETTINGS[surface], url) };
          });
          type X = (typeof list)[number];
          const cols: Column<X>[] = [
            { key: 'surface', header: t('common.engines.admin.surface'), value: (x) => x.surface, render: (x) => t(`common.engines.surface.${x.surface}`) },
            { key: 'requested', header: t('common.engines.admin.requested'), value: (x) => x.eng.requested, render: (x) => t(`common.engines.kind.${x.eng.requested}`) },
            { key: 'serving', header: t('common.engines.admin.serving'), value: (x) => x.eng.status, render: (x) => <EngineBadge engine={x.eng} /> },
            { key: 'weights', header: t('common.engines.admin.weights'), value: (x) => JSON.stringify(x.eng.weights), render: (x) => <span className="font-mono text-[12px]" dir="ltr">{Object.entries(x.eng.weights).map(([k, v]) => `${k} ${f.num(v)}`).join(' · ')}</span> },
            ...(canSet
              ? [{ key: 'act', header: '', csv: false, render: (x: X) => (
                  <button className="btn-outline btn-sm" data-testid={`m16-engine-${x.surface}`} onClick={() => setPending({ surface: x.surface, engine: x.eng.requested === 'model' ? 'deterministic' : 'model' })}>
                    {x.eng.requested === 'model' ? t('common.engines.admin.useDeterministic') : t('common.engines.admin.useModel')}
                  </button>
                ) } as Column<X>]
              : []),
          ];
          return <div data-testid="m16-engines"><DataTable rows={list} rowKey={(x) => x.surface} columns={cols} csvName="kafaa-engines" /></div>;
        }}
      </Async>
      <GatedConfirm
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? t('common.engines.admin.confirmTitle', { surface: t(`common.engines.surface.${pending.surface}`), engine: t(`common.engines.kind.${pending.engine}`) }) : ''}
        consequence={t('common.engines.admin.consequence')}
        actingAs={t('m16.hub.asAdmin')}
        onConfirm={() => pending && run(() => repo.rpc.setEngineWeights(pending.surface, pending.engine, null), { success: t('common.engines.admin.saved') })}
      />
    </Card>
  );
}

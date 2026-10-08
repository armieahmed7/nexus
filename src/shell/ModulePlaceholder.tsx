/**
 * Placeholder page used by every scaffolded route until its module group replaces it. Shows what the page is for,
 * who owns it, its guard, and live row counts of the module's tables as the current viewer sees them (RLS applies).
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, KeyValue, StatusPill, Skeleton } from '../ui/Page';
import { useQuery, useRepo } from '../data';
import { useT, useLang, useFormat } from '../i18n';
import { ROUTE_BY_ID } from '../routes/registry';
import { MODULES } from '../routes/modules';
import { SCHEMA } from '../data/schema';
import type { Table } from '../data/types';
import { routePurpose, routeTitle } from './util';

export function ModulePlaceholder({ routeId }: { routeId: string }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const repo = useRepo();
  const params = useParams();
  const def = ROUTE_BY_ID[routeId];
  const mod = MODULES[def.module];
  const tables = useMemo(() => Object.entries(SCHEMA).filter(([, d]) => d.module === def.module && !d.localOnly).map(([k]) => k as Table), [def.module]);
  const counts = useQuery(tables, async () => Promise.all(tables.map(async (tb) => [tb, await repo.count(tb).catch(() => -1)] as const)), [tables.join(',')]);
  const g = def.guard;
  const guardText = g.anyRole || g.grant ? [g.anyRole?.join(', '), g.grant ? `${g.grant.res}: ${g.grant.levels.join('/')}` : ''].filter(Boolean).join(' · ') : g.signedIn ? t('common.placeholder.signedIn') : t('common.placeholder.public');
  return (
    <Page title={routeTitle(t, def)} eyebrow={lang === 'ar' ? mod.ar : mod.en} intro={routePurpose(t, def)}>
      <Card title={t('common.placeholder.title')} eyebrow={`${def.module} · ${mod.group}`}>
        <p className="mb-4 text-ink-2">{t('common.placeholder.body')}</p>
        <KeyValue
          items={[
            [t('common.placeholder.route'), <code key="r" className="ltr">{def.path}</code>],
            [t('common.placeholder.params'), Object.keys(params).length ? <code key="p" className="ltr">{JSON.stringify(params)}</code> : '—'],
            [t('common.placeholder.owner'), `${mod.group} (${def.module})`],
            [t('common.placeholder.guard'), <code key="g" className="ltr">{guardText}</code>],
            [t('common.placeholder.spec'), def.spec],
          ]}
        />
      </Card>
      <Card title={t('common.placeholder.data')}>
        {!counts.data ? (
          <Skeleton lines={3} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="placeholder-counts">
            {counts.data.map(([tb, n]) => (
              <li key={tb} className="flex items-center justify-between rounded-btn border border-line px-3 py-2">
                <code className="ltr text-[12px]">{tb}</code>
                {n < 0 ? <StatusPill tone="neutral">{t('common.placeholder.noAccess')}</StatusPill> : <span className="num font-semibold">{f.num(n)}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

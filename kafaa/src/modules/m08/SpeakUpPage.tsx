// M08 · Speak up: a pointer to the Employee Concerns Program channels. It contains no form, stores no text, writes
// nothing (no repository writes, no audit, no analytics, no toasts) and Dalil is not shown here (route guard
// noTelemetry). Content is owned by the ECP; editors cannot change it without ECP approval.
import { useQuery, useRepo } from '../../data';
import { usePick, useT } from '../../i18n';
import { Async, Callout, Icon, Page } from '../../ui';

const ICONS: Record<string, string> = { office: 'home', intranet: 'link', phone: 'chat', email: 'chat', reps: 'users', r2p: 'external' };

export default function SpeakUpPage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  // Read-only: ECP channels as published by the ECP (public reference data).
  const channels = useQuery('ecp_channels', () => repo.list('ecp_channels', { order: [['sort', 'asc']] }));
  return (
    <Page title={t('m08.routes.speak-up.title')} eyebrow={t('m08.speak.eyebrow')} intro={t('m08.speak.intro')}>
      <div role="note" className="card border-accent bg-accent-soft p-4" data-testid="m08-speak-protection">
        <div className="flex items-start gap-3">
          <Icon name="shield" size={22} className="mt-0.5 text-eyebrow" />
          <div>
            <p className="text-[15px] font-semibold">{t('m08.speak.protectionTitle')}</p>
            <p className="mt-1 text-[14px] text-ink-2">{t('m08.speak.protection')}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">{t('m08.speak.channelsTitle')}</h2>
        <Async state={channels}>
          {(rows) => (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="m08-ecp-channels">
              {rows.map((c) => (
                <li key={c.id} className={`card p-4 ${c.kind === 'r2p' ? 'border-dashed' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Icon name={ICONS[c.kind] ?? 'info'} className="text-eyebrow" />
                    <span className="font-semibold">{pick(c, 'label')}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-2">{pick(c, 'detail')}</p>
                  {c.kind === 'r2p' && <p className="mt-1 text-[12px] text-ink-3">{t('m08.speak.external')}</p>}
                </li>
              ))}
            </ul>
          )}
        </Async>
        <p className="text-[12px] text-ink-3">{t('m08.speak.sourceNote')}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-4" data-testid="m08-speak-anonymous">
          <h2 className="text-[16px] font-semibold">{t('m08.speak.anonTitle')}</h2>
          <p className="mt-1 text-[13.5px] text-ink-2">{t('m08.speak.anonBody')}</p>
        </div>
        <div className="card p-4">
          <h2 className="text-[16px] font-semibold">{t('m08.speak.whatTitle')}</h2>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-[13.5px] text-ink-2">
            <li>{t('m08.speak.what.1')}</li>
            <li>{t('m08.speak.what.2')}</li>
            <li>{t('m08.speak.what.3')}</li>
          </ul>
        </div>
      </section>

      <Callout tone="info" title={t('m08.speak.privacyTitle')}>
        {t('m08.speak.privacyBody')}
      </Callout>
      <p className="text-[12px] text-ink-3" data-testid="m08-speak-owner">{t('m08.speak.owner')}</p>
    </Page>
  );
}

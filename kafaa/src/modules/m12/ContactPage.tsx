// M12 · Contact: a form with real routing to a role mailbox (never a named person), a stated purpose, optional contact
// details with consent, and a published retention period. Concerns are redirected to the ECP channels.
import { useState } from 'react';
import { useAction, useRepo } from '../../data';
import { L, useI18n, useT } from '../../i18n';
import { Callout, Card, CheckboxField, Icon, Page, SelectField, TextArea, TextField, email, maxLen, minLen, required, useForm } from '../../ui';
import { CONTACT_ROUTES } from '../../domain/g5rules';
import { todayIso } from '../../domain/rules';
import { useFlags } from '../m16/flags';
import { OfficialLink } from './parts';

const TOPICS = Object.keys(CONTACT_ROUTES);
const RETENTION_DAYS = 180;

export default function ContactPage() {
  const t = useT();
  const { lang } = useI18n();
  const repo = useRepo();
  const run = useAction();
  const { isOn, loading } = useFlags();
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState<{ id: string; route: string } | null>(null);
  const form = useForm({ topic: '', message: '', name: '', mail: '' }, { topic: [required()], message: [required(), minLen(10), maxLen(2000)], mail: [email()], name: [maxLen(120)] });
  const routeTo = form.values.topic ? CONTACT_ROUTES[form.values.topic] : null;
  const needsConsent = !!(form.values.name.trim() || form.values.mail.trim());
  const looksLikeConcern = /concern|harass|retaliat|unsafe|report|مخاوف|بلاغ|مضايقة/i.test(form.values.message);

  const submit = form.handleSubmit(async (v) => {
    if (needsConsent && !consent) return;
    const keep = new Date(`${todayIso()}T00:00:00Z`);
    keep.setUTCDate(keep.getUTCDate() + RETENTION_DAYS);
    const r = await run(
      () => repo.insert('contact_requests', { topic: v.topic as never, route_to: CONTACT_ROUTES[v.topic], name: v.name.trim() || null, email: v.mail.trim() || null, message: v.message.trim(), status: 'routed', lang, consent_contact: needsConsent && consent, retention_until: keep.toISOString().slice(0, 10) }, { returning: 'minimal' }), // visitors may send but not read requests: no RETURNING
      { success: t('m12.contact.sent') },
    );
    if (r.ok && r.data) {
      setDone({ id: r.data.id, route: CONTACT_ROUTES[v.topic] });
      form.reset();
      setConsent(false);
    }
  });

  return (
    <Page title={t('m12.routes.contact.title')} intro={t('m12.contact.intro')}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {done && (
            <div role="status" className="card border-ok-line bg-ok-bg p-4" data-testid="m12-contact-done">
              <div className="flex items-center gap-2 font-semibold text-ok">
                <Icon name="check" />
                {t('m12.contact.doneTitle')}
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{t('m12.contact.doneBody', { route: done.route, ref: done.id })}</p>
              <button className="btn-outline btn-sm mt-3" onClick={() => setDone(null)}>
                {t('m12.contact.another')}
              </button>
            </div>
          )}
          {!loading && !isOn('contact_form') ? (
            <Callout tone="sim" title={t('m12.contact.closedTitle')}>
              {t('m12.contact.closedBody')}
            </Callout>
          ) : (
            !done && (
              <Card>
                <form onSubmit={submit} className="space-y-4" noValidate data-testid="m12-contact-form">
                  <p className="text-[13px] text-ink-2">{t('m12.contact.purpose')}</p>
                  <SelectField label={t('m12.contact.topic')} required options={TOPICS.map((x) => ({ value: x, label: t(`m12.contact.topics.${x}`) }))} {...form.field('topic')} hint={routeTo ? t('m12.contact.routesTo', { route: routeTo }) : undefined} />
                  <TextArea label={t('m12.contact.message')} required rows={6} {...form.field('message')} hint={t('m12.contact.messageHint')} />
                  {looksLikeConcern && (
                    <Callout tone="info" title={t('m12.contact.concernTitle')}>
                      {t('m12.contact.concernBody')} <L to="/speak-up">{t('m12.contact.concernLink')}</L>
                    </Callout>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label={t('m12.contact.name')} {...form.field('name')} autoComplete="name" hint={t('m12.contact.optional')} />
                    <TextField label={t('m12.contact.email')} type="email" {...form.field('mail')} autoComplete="email" hint={t('m12.contact.optional')} />
                  </div>
                  {needsConsent && <CheckboxField label={t('m12.contact.consent')} hint={t('m12.contact.consentHint', { days: RETENTION_DAYS })} checked={consent} onChange={setConsent} />}
                  {needsConsent && !consent && <p className="text-[12px] text-bad">{t('m12.contact.consentNeeded')}</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" className="btn-primary" disabled={form.submitting || (needsConsent && !consent)} data-testid="m12-contact-submit">
                      {form.submitting ? t('common.working') : t('m12.contact.send')}
                    </button>
                    <span className="text-[12px] text-ink-3">{t('m12.contact.retention', { days: RETENTION_DAYS })}</span>
                  </div>
                </form>
              </Card>
            )
          )}
        </div>
        <aside className="space-y-3">
          <div className="caps">{t('m12.contact.officialTitle')}</div>
          <OfficialLink href="https://www.enec.ae/careers-and-scholarships/careers/" title={t('m12.contact.official.careers')} />
          <OfficialLink href="https://www.enec.ae/vendors/vendor-education/icv/" title={t('m12.contact.official.vendors')} />
          <OfficialLink href="https://www.enec.ae/about-us/overview/" title={t('m12.contact.official.enec')} />
          <Callout tone="info" title={t('m12.contact.safetyTitle')}>
            {t('m12.contact.safetyBody')} <L to="/speak-up">{t('m12.contact.concernLink')}</L>
          </Callout>
        </aside>
      </div>
    </Page>
  );
}

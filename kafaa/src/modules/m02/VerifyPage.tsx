// M02 /verify: verify a Kafa'a-issued internal course certificate by number (rpc.verifyCertificate). Never a FANR
// operator certificate. The answer carries no personal data beyond the holder's initials.
import { useState } from 'react';
import { Page, Card, Callout, StatusPill, KeyValue, TextField, useForm, required, pattern, Icon } from '../../ui';
import { useRepo, type CertificateCheck } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';

export default function VerifyPage() {
  const t = useT();
  const repo = useRepo();
  const pick = usePick();
  const f = useFormat();
  const [res, setRes] = useState<{ no: string; r: CertificateCheck } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const form = useForm({ no: '' }, { no: [required(), pattern(/^[A-Za-z0-9-]{6,32}$/, 'm02.verify.format')] });
  return (
    <Page title={t('m02.routes.verify.title')} intro={t('m02.verify.intro')}>
      <Callout tone="info" title={t('m02.verify.notFanrTitle')}>
        {t('m02.verify.notFanrBody')}{' '}
        <a href="https://www.fanr.gov.ae/en" target="_blank" rel="noopener noreferrer">
          fanr.gov.ae <Icon name="external" size={12} className="inline" />
        </a>
      </Callout>
      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={form.handleSubmit(async (v) => {
            setErr(null);
            try {
              const r = await repo.rpc.verifyCertificate(v.no.trim());
              setRes({ no: v.no.trim(), r });
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
            }
          })}
          data-testid="m02-verify-form"
        >
          <div className="min-w-[260px] flex-1">
            <TextField label={t('m02.verify.number')} {...form.field('no')} placeholder="KAF-2026-000417" hint={t('m02.verify.hint')} required autoComplete="off" />
          </div>
          <button className="btn-primary" type="submit" disabled={form.submitting} data-testid="m02-verify-submit">
            {form.submitting ? t('common.working') : t('m02.verify.check')}
          </button>
        </form>
      </Card>
      <div aria-live="polite">
        {err && <Callout tone="bad" title={t('common.errorTitle')}>{err}</Callout>}
        {res &&
          (res.r.found ? (
            <Card title={t('m02.verify.found')} eyebrow={res.r.certificate_no} actions={<StatusPill status={res.r.status} />}>
              <div data-testid="m02-verify-result">
                <KeyValue
                  items={[
                    [t('m02.verify.course'), `${res.r.course_code ?? ''} ${pick({ x_en: res.r.course_en, x_ar: res.r.course_ar }, 'x')}`],
                    [t('m02.verify.issued'), f.date(res.r.issued_on)],
                    [t('m02.verify.validTo'), res.r.valid_to ? f.date(res.r.valid_to) : t('m02.verify.noExpiry')],
                    [t('m02.verify.holder'), res.r.holder_initials ?? '—'],
                  ]}
                />
                <p className="mt-3 text-[12.5px] text-ink-3">{t('m02.verify.note')}</p>
              </div>
            </Card>
          ) : (
            <Callout tone="bad" title={t('m02.verify.notFound')}>
              {t('m02.verify.notFoundBody', { no: res.no })}
            </Callout>
          ))}
      </div>
    </Page>
  );
}

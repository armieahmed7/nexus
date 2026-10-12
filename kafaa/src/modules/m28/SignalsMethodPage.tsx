// FS70 /skills/rising/method (public): how ENEC Skills on the Rise is counted. Every threshold on this page is read from the rule
// (src/modules/m28/signals.ts), so the published method and the published list can never disagree. Also explains the manager pulse
// question and how it is aggregated, and links the FS71 badge criteria.
import { L, useFormat, useT } from '../../i18n';
import { Page, Section, Card, Callout, BenchmarkChips } from '../../ui';
import { BadgeCriteria, SignalRules } from './fs70ui';
import { FIRST_QUARTER, METHOD_VERSION, MIN_SIGNAL, PULSE_BANDS } from './signals';

export default function SignalsMethodPage() {
  const t = useT();
  const f = useFormat();
  return (
    <Page title={t('m28.routes.skills-rising-method.title')} intro={t('m28.sm.intro')} eyebrow={<BenchmarkChips feature="FS70" />}
      actions={<L to="/skills/rising" className="btn-outline btn-sm no-underline" data-testid="m28-sm-to-list">{t('m28.sm.toList')}</L>}>
      <div className="space-y-6" data-testid="m28-sm">
        <Section title={t('m28.sm.signalsTitle')} description={t('m28.sm.signalsIntro')}><SignalRules /></Section>
        <Section title={t('m28.sm.publishTitle')}>
          <Card>
            <ul className="list-disc space-y-1 ps-5 text-[13.5px] text-ink-2" data-testid="m28-sm-publish">
              <li>{t('m28.sm.p.quarterly', { first: FIRST_QUARTER })}</li>
              <li>{t('m28.sm.p.who')}</li>
              <li>{t('m28.sm.p.version', { v: METHOD_VERSION })}</li>
              <li>{t('m28.sm.p.reasons')}</li>
            </ul>
          </Card>
        </Section>
        <Section title={t('m28.sm.pulseTitle')} description={t('m28.sm.pulseIntro')}>
          <Card>
            <p className="mb-2 font-semibold" data-testid="m28-sm-question">{t('m28.mp.question')}</p>
            <ul className="list-disc space-y-1 ps-5 text-[13.5px] text-ink-2">
              <li>{t('m28.sm.pulse.who')}</li>
              <li>{t('m28.sm.pulse.agg', { n: f.num(MIN_SIGNAL) })}</li>
              <li>{t('m28.sm.pulse.bands', { list: PULSE_BANDS.map(([a, b]) => `${f.num(a)}-${f.num(b)}%`).join(t('m28.rs.sep')) })}</li>
              <li>{t('m28.sm.pulse.private')}</li>
            </ul>
          </Card>
        </Section>
        <Section title={t('m28.sm.badgesTitle')} description={t('m28.sm.badgesIntro')}><BadgeCriteria /></Section>
        <Callout tone="info" title={t('m28.sm.benchTitle')}>{t('m28.sm.benchBody')}</Callout>
      </div>
    </Page>
  );
}

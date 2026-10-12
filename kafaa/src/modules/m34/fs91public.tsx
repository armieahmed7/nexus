// FS78 + FS79 public tab on /recognition (fsIe1): how the learning balance and protected study time work (SIMULATED rule: base grant,
// mid-career top-up from years of service, spend only on the outcome-gated catalogue, maker-checker decisions) and how external
// certificates are verified (trust tiers; claimed until verified; reviewed crosswalk rows only). Benchmarks come from kafaa_benchmarks.
import { BenchmarkChips, Card, Section, SimChip, Stepper } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { BASE_HOURS, CREDIT_HOURS, MID_CAREER_YEARS, TOPUP_HOURS } from './balance';
import { TierLegend } from './fs91ui';

export function BalanceCertsTab() {
  const t = useT();
  const f = useFormat();
  return (
    <div className="space-y-6" data-testid="m34-pub-balance">
      <Section title={t('m34.pub.balTitle')} description={t('m34.pub.balDesc')} actions={<SimChip />}>
        <div className="mb-3"><BenchmarkChips feature="FS78" /></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card title={t('m34.pub.balGrant')}><p className="text-[13px] text-ink-2">{t('m34.pub.balGrantBody', { c: f.num(BASE_HOURS / CREDIT_HOURS), h: f.num(BASE_HOURS), tc: f.num(TOPUP_HOURS / CREDIT_HOURS), y: f.num(MID_CAREER_YEARS) })}</p></Card>
          <Card title={t('m34.pub.balSpend')}><p className="text-[13px] text-ink-2">{t('m34.pub.balSpendBody')}</p><L to="/learn/external" className="mt-2 inline-block text-[13px] text-accent hover:underline">{t('m34.sb.toCatalogue')}</L></Card>
          <Card title={t('m34.pub.balTime')}><p className="text-[13px] text-ink-2">{t('m34.pub.balTimeBody')}</p></Card>
        </div>
        <div className="mt-3"><Stepper steps={[1, 2, 3, 4].map((n) => ({ id: `s${n}`, label: t(`m34.pub.balStep${n}`) }))} current={-1} /></div>
      </Section>
      <Section title={t('m34.pub.certTitle')} description={t('m34.pub.certDesc')}>
        <div className="mb-3"><BenchmarkChips feature="FS79" /></div>
        <TierLegend />
        <p className="mt-3 text-[13px] text-ink-2">{t('m34.pub.certMap')}</p>
      </Section>
    </div>
  );
}

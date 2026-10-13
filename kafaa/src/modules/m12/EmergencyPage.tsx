// M12 · Emergency information. Acceptance: this section contains only links to official pages and the
// "Go In, Stay In, Listen In" headline. It deliberately restates no zones, distances or instructions.
import { useT } from '../../i18n';
import { Page } from '../../ui';
import { OfficialLink } from './parts';

const LINKS = [
  { k: 'enecFaq', url: 'https://www.enec.ae/our-subsidiaries/enec-operations/emergency-preparedness-faqs/' },
  { k: 'enecEp', url: 'https://www.enec.ae/regulation/safety-at-enec/emergency-preparedness/' },
  { k: 'ncema', url: 'https://www.ncema.gov.ae/' },
  { k: 'fanr', url: 'https://www.fanr.gov.ae/en' },
];

export default function EmergencyPage() {
  const t = useT();
  return (
    <Page title={t('m12.routes.emergency.title')}>
      <section className="card border-accent p-6 text-center" data-testid="m12-emergency-headline">
        <p className="text-[26px] font-semibold leading-tight text-eyebrow sm:text-[32px]">{t('m12.emergency.headline')}</p>
      </section>
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="m12-emergency-links">
        {LINKS.map((l) => (
          <li key={l.k} className="min-w-0">
            <OfficialLink href={l.url} title={t(`m12.emergency.links.${l.k}`)} />
          </li>
        ))}
      </ul>
    </Page>
  );
}

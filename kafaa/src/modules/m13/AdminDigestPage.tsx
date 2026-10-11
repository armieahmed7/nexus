// W5E5 (F36) · /admin/digest: personal digest and nudge aggregates for admins and auditors (open rate per period, items per kind,
// settings counts; every count under 10 suppressed). The digest UI and rules live in src/shell/digest.
import { useT } from '../../i18n';
import { Page } from '../../ui';
import { DigestStats } from '../../shell/digest/DigestStats';

export default function AdminDigestPage() {
  const t = useT();
  return (
    <Page title={t('m13.routes.admin-digest.title')} intro={t('m13.routes.admin-digest.purpose')}>
      <DigestStats />
    </Page>
  );
}

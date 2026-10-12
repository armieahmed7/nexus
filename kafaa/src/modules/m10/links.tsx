// FS66/FS67 (fsGe4): link cards from the existing M10 pages to programme alignment and fellowships.
import { Card, Grid } from '../../ui';
import { L, useT } from '../../i18n';
import { useSession } from '../../auth/session';

export function FutureSkillsLinks({ partner }: { partner?: boolean }) {
  const t = useT();
  const signedIn = !!useSession().identity.personId;
  return (
    <Grid cols={2}>
      <Card title={t('m10.links.uaTitle')} eyebrow={t('m10.links.eyebrow')}>
        <p className="text-[13px] text-ink-2">{t('m10.links.uaBody')}</p>
        {partner ? <L to="/partner/university/programmes" className="mt-2 inline-block text-[13px]" data-testid="m10-link-programmes">{t('m10.links.uaPartner')}</L>
          : <span className="mt-2 inline-block text-[12.5px] text-ink-3">{t('m10.links.uaPublic')}</span>}
      </Card>
      <Card title={t('m10.links.fwTitle')} eyebrow={t('m10.links.eyebrow')}>
        <p className="text-[13px] text-ink-2">{t('m10.links.fwBody')}</p>
        {signedIn ? <L to="/universities/fellowships" className="mt-2 inline-block text-[13px]" data-testid="m10-link-fellowships">{t('m10.links.fwOpen')}</L>
          : <span className="mt-2 inline-block text-[12.5px] text-ink-3">{t('m10.links.signIn')}</span>}
      </Card>
    </Grid>
  );
}

// FS29 /my/recognition/rpl/:id · One RPL request seen by the person (or the assessor who opened it for a contractor): the evidence pack
// assembled from their own records, attestation requests, the advisory sufficiency reasons, submit or withdraw, and after the two-person
// decision the RPL statement and the NQC-ready export. Rows are read through RLS: anyone else sees "not found".
import { useParams } from 'react-router-dom';
import { Page } from '../../ui';
import { L, useT } from '../../i18n';
import { Bench, RplDetail } from './ui';

export default function RplRequestPage() {
  const t = useT();
  const { id = '' } = useParams();
  return (
    <Page title={t('m34.routes.my-rpl.title')} eyebrow={t('m34.detail.eyebrow')} intro={t('m34.detail.intro')} wide actions={<L to="/my/recognition" className="btn-outline">{t('m34.detail.back')}</L>}>
      <Bench />
      <RplDetail id={id} mode="person" />
    </Page>
  );
}

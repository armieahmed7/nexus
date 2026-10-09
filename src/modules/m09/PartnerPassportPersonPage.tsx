// F33 /partner/workforce/passport/:personId: one contractor's passport (the contractor themself or their organisation's partner admin).
// Another organisation's contractor is simply "not found" (RLS returns nothing).
import { useParams } from 'react-router-dom';
import { Page, Async, EmptyState } from '../../ui';
import { useT, usePick, L } from '../../i18n';
import { ContractorPassportView, NotAuthority, cpName, useCpData } from './passportUi';
import { useMyOrg } from './shared';

export default function PartnerPassportPersonPage() {
  const t = useT();
  const pick = usePick();
  const { personId } = useParams();
  const me = useMyOrg().personId;
  const q = useCpData(personId ?? null);
  const title = q.data ? cpName(q.data, t, pick) : t('m09.routes.partner-passport-person.title');
  return (
    <Page title={title} eyebrow={t('m09.routes.partner-passport-person.title')} actions={<L to="/partner/workforce/passport" className="btn-ghost">{t('m09.cp.back')}</L>}>
      <NotAuthority />
      <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m09.cp.notFound')}>{t('m09.cp.notFoundBody')}</EmptyState>}>
        {(d) => <ContractorPassportView d={d!} mode={personId === me ? 'self' : 'admin'} precheckHref={`/partner/workforce/precheck?person=${encodeURIComponent(personId ?? '')}`} />}
      </Async>
    </Page>
  );
}

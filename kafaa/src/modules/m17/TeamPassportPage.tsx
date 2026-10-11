// F03 /team/passport/:personId: read-only passport of a person in my scope (managers, instructors: skills_profile Scope;
// training managers: A). The repository applies RLS, so a person outside the scope shows as not available.
import { useParams } from 'react-router-dom';
import { Page, Async, Callout } from '../../ui';
import { useT } from '../../i18n';
import { PassportView } from './PassportView';
import { usePassportData } from './ui';
import { GoalsStrip } from './goalsUi'; // FS33: goals shared with me (opt-in, RLS)

export default function TeamPassportPage() {
  const t = useT();
  const { personId = '' } = useParams();
  const q = usePassportData(personId);
  return (
    <Page title={t('m17.routes.team-passport.title')} intro={t('m17.team.intro')}>
      <Callout tone="info" title={t('m17.team.readOnly')}>{t('m17.team.readOnlyBody')}</Callout>
      <GoalsStrip person={personId} readOnly />
      <Async state={q}>{(d) => <PassportView d={d} readOnly />}</Async>
    </Page>
  );
}

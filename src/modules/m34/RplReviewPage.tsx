// FS29 /recognition/review/:id · An assessor reviews an RPL evidence pack: relevance of each item to the target, the advisory sufficiency
// reasons (deterministic, never the decision), then maker-checker: one assessor recommends full, partial or not-yet credit with a rationale
// and recognised hours; a second assessor confirms or returns it. Neither can be the person. Auditors read only.
import { useParams } from 'react-router-dom';
import { Page } from '../../ui';
import { L, useT } from '../../i18n';
import { Bench, RplDetail } from './ui';

export default function RplReviewPage() {
  const t = useT();
  const { id = '' } = useParams();
  return (
    <Page title={t('m34.routes.rpl-review.title')} eyebrow={t('m34.review.eyebrow')} intro={t('m34.review.intro')} wide actions={<L to="/recognition/review" className="btn-outline">{t('m34.review.back')}</L>}>
      <Bench />
      <RplDetail id={id} mode="review" />
    </Page>
  );
}

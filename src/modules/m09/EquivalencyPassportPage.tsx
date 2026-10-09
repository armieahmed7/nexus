// F33 /training/equivalency/passport/:personId: an ENEC evaluator (equivalency A) or auditor (R) reads a contractor's passport and runs
// the pre-check for a standard before mapping the evidence on /training/equivalency. Read-only: the decision stays with the evaluator.
import { useParams, useSearchParams } from 'react-router-dom';
import { Page, Async, EmptyState, Callout } from '../../ui';
import { useT, usePick, L } from '../../i18n';
import { ContractorPassportView, PrecheckPanel, cpName, useCpData } from './passportUi';

export default function EquivalencyPassportPage() {
  const t = useT();
  const pick = usePick();
  const { personId } = useParams();
  const [params] = useSearchParams();
  const q = useCpData(personId ?? null);
  return (
    <Page title={q.data ? cpName(q.data, t, pick) : t('m09.routes.training-equivalency-passport.title')} eyebrow={t('m09.routes.training-equivalency-passport.title')}
      actions={<L to="/training/equivalency" className="btn-ghost">{t('m09.cp.backEq')}</L>}>
      <Callout tone="info" title={t('m09.cp.evalTitle')}>{t('m09.cp.evalBody')}</Callout>
      <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m09.cp.notFound')}>{t('m09.cp.notFoundBody')}</EmptyState>}>
        {(d) => (
          <div className="space-y-6">
            <PrecheckPanel d={d!} canSubmit={false} initialStd={params.get('standard') ?? d!.requests.find((r) => ['submitted', 'under_review'].includes(r.status))?.standard_id ?? null} />
            <ContractorPassportView d={d!} mode="evaluator" />
          </div>
        )}
      </Async>
    </Page>
  );
}

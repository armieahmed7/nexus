// F33 /partner/workforce/precheck: the read-only equivalency pre-check. The partner admin picks a contractor of their organisation and a
// standard, sees the likely coverage per task (with reasons) and can then submit the request through the existing submitEquivalency.
// A contractor can pre-check their own passport. The pre-check never changes an equivalency record.
import { useSearchParams } from 'react-router-dom';
import { Page, Async, EmptyState, Card, SelectField } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L } from '../../i18n';
import { NotAuthority, PrecheckPanel, useCpData, type Row } from './passportUi';
import { useMyOrg } from './shared';

export default function PartnerPrecheckPage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const { orgId, isAdmin, personId } = useMyOrg();
  const [params, setParams] = useSearchParams();
  const people = useQuery(['people'], async () => (isAdmin ? ((await repo.list('people', { filter: { org_id: orgId ?? '' }, order: [['display_name', 'asc']] })) as Row[]) : []), [orgId, isAdmin]);
  const chosen = isAdmin ? params.get('person') ?? '' : personId ?? '';
  const q = useCpData(chosen || null);
  const set = (v: string) => { const p = new URLSearchParams(params); if (v) p.set('person', v); else p.delete('person'); setParams(p, { replace: true }); };
  return (
    <Page title={t('m09.routes.partner-precheck.title')} intro={t('m09.cp.pcIntro')} actions={<L to="/partner/workforce/passport" className="btn-ghost">{t('m09.cp.back')}</L>}>
      <NotAuthority />
      {isAdmin && (
        <Card>
          <SelectField label={t('m09.cp.pcPerson')} name="person" value={chosen} onChange={set} options={(people.data ?? []).filter((p) => p.kind === 'contractor').map((p) => ({ value: p.id, label: pick(p, 'display_name') }))} />
        </Card>
      )}
      {!chosen ? <EmptyState title={t('m09.cp.pcChoose')} /> : (
        <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m09.cp.notFound')}>{t('m09.cp.notFoundBody')}</EmptyState>}>
          {(d) => <PrecheckPanel key={chosen} d={d!} canSubmit={isAdmin} initialStd={params.get('standard')} />}
        </Async>
      )}
    </Page>
  );
}

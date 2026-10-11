// /talent/review/pool (M23 · F18 → F16): the HiPo pool from locked review cycles (boxes 8 and 9), in the caller's scope. Line
// managers nominate pool members for ESTADAD through the Leadership Academy (rpc.nominateLeader, decided by HR: maker-checker).
import { Page, Async, EmptyState, Section, Callout } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, usePick, useT } from '../../i18n';
import { ConfidentialNote, unwrap, useCatalogue, useLabels } from './ui';
import { HipoList } from './CyclePage';
import type { CycleSummary, TalentBoard } from './backend/rpc';

export default function HipoPoolPage() {
  const t = useT();
  const repo = useRepo();
  const pick = usePick();
  const cat = useCatalogue();
  const lab = useLabels(cat.data);
  const q = useQuery(['review_placements', 'review_cycles', 'talent_pool'], async () => {
    const cycles = await unwrap<CycleSummary[]>(repo.rpc.talentCycles());
    const boards: TalentBoard[] = [];
    for (const c of cycles.filter((x) => x.status === 'locked' && x.in_view > 0)) boards.push(await unwrap<TalentBoard>(repo.rpc.talentBoard(c.id)));
    return boards;
  }, []);
  return (
    <Page title={t('m23.routes.talent-review-pool.title')} intro={t('m23.pool.pageIntro')} eyebrow={<L to="/talent/review">{t('m23.common.back')}</L>} wide>
      <ConfidentialNote />
      <Callout title={t('m23.pool.feedTitle')}>{t('m23.pool.feedBody')} <L to="/leadership/nominations">{t('m23.pool.toNominations')}</L></Callout>
      <Async state={q} empty={<EmptyState icon="sparkle" title={t('m23.pool.none')}>{t('m23.pool.noneBody')}</EmptyState>} isEmpty={(d) => d.every((b) => !b.members.some((m) => m.placement?.hipo))}>
        {(boards) => (
          <div className="space-y-6" data-testid="m23-pool">
            {boards.filter((b) => b.members.some((m) => m.placement?.hipo)).map((b) => (
              <Section key={b.cycle.id} title={pick(b.cycle, 'title')} description={`${b.cycle.code} · ${b.cycle.period}`}>
                <HipoList members={b.members.filter((m) => m.placement?.hipo)} lab={lab} />
              </Section>
            ))}
          </div>
        )}
      </Async>
    </Page>
  );
}

// /learn/practice (M05, public): open practice quizzes on public topics for students and applicants. No account needed;
// nothing is stored on the server. Recognition is allowed here (spec: badges for outreach and students only).
import { Page, Grid, Card, Async, EmptyState, Callout, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Chip } from '../m04/ui';
import { readBest } from './practiceStore';

export default function LearnPracticePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery('assessment_forms', () => repo.list('assessment_forms', { filter: { is_practice: true }, order: [['title_en', 'asc']] }), []);
  return (
    <Page title={t('m05.routes.learn-practice.title')} eyebrow={t('m05.practice.eyebrow')} intro={t('m05.practice.intro')}>
      <Callout title={t('m05.practice.privacyTitle')}>{t('m05.practice.privacy')}</Callout>
      <Async state={q} empty={<EmptyState icon="book" title={t('m05.practice.none')} />}>
        {(forms) => (
          <Grid cols={3}>
            {forms.map((x) => {
              const best = readBest(x.id);
              return (
                <Card key={x.id} as="article" eyebrow={pick(x, 'audience')} title={pick(x, 'title')} footer={best != null ? <span className="inline-flex items-center gap-1"><Icon name="sparkle" size={14} className="text-eyebrow" />{t('m05.practice.best', { n: f.pct(best, 0) })}</span> : t('m05.practice.notTried')}>
                  <div className="flex flex-wrap gap-1.5"><Chip>{t('m05.practice.questions', { n: f.num(x.item_ids.length) })}</Chip><Chip>{t('m05.practice.minutes', { n: f.num(x.time_limit_min) })}</Chip><Chip tone="ok">{t('m05.practice.instant')}</Chip></div>
                  <L to={`/learn/practice/${x.id}`} className="btn-primary btn-sm mt-3" data-testid={`m05-practice-${x.id}`}>{best != null ? t('m05.practice.again') : t('m05.practice.start')}<Icon name="chevron" size={14} /></L>
                </Card>
              );
            })}
          </Grid>
        )}
      </Async>
      <Callout title={t('m05.practice.secureTitle')}>{t('m05.practice.secure')}</Callout>
    </Page>
  );
}

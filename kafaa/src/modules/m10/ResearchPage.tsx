// M10 /research: curated public research challenges (published only after a screening sign-off), the proposal process and
// IP routing to the patents route agreed with the Ministry of Economy and Tourism (May 2026). No plant research data here.
import { useMemo } from 'react';
import { useRepo, useQuery } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, Stepper, FilterBar, useFilters } from '../../ui';
import { L, useT } from '../../i18n';
import { ChallengeCard, MoetLink, useThemeLabel } from './shared';

export default function ResearchPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const themeLabel = useThemeLabel();
  const [flt, setFlt] = useFilters({ q: '', theme: '' }, true);
  const q = useQuery('research_challenges', () => repo.list('research_challenges', { filter: { is_published: true }, order: [['closes_on', 'asc']] }));
  const themes = useMemo(() => [...new Set((q.data ?? []).map((c) => c.theme))].sort(), [q.data]);
  const shown = useMemo(() => {
    const term = flt.q.trim().toLowerCase();
    return (q.data ?? []).filter((c) => (!flt.theme || c.theme === flt.theme) && (!term || `${c.title_en} ${c.title_ar} ${c.summary_en} ${c.summary_ar}`.toLowerCase().includes(term)));
  }, [q.data, flt]);
  const isPartner = s.hasRole('partner_user', 'partner_admin', 'university');
  const cta = isPartner ? (
    <L to="/partner/research" className="btn-primary btn-sm" data-testid="m10-propose">{t('m10.res.propose')}</L>
  ) : s.status === 'signed_in' ? (
    <span className="text-[12.5px] text-ink-3">{t('m10.res.partnersOnly')}</span>
  ) : (
    <L to={`/sign-in?next=${encodeURIComponent('/partner/research')}`} className="btn-outline btn-sm">{t('m10.res.signInPartner')}</L>
  );
  return (
    <Page title={t('m10.routes.research.title')} intro={t('m10.res.intro')}>
      <Callout tone="info" title={t('m10.res.screenTitle')}>{t('m10.res.screenBody')}</Callout>
      <Section title={t('m10.res.openTitle')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[{ key: 'theme', label: t('m10.res.theme'), options: themes.map((x) => ({ value: x, label: themeLabel(x) })) }]} />
        <Async state={q} empty={<EmptyState title={t('m10.res.none')} />}>
          {() =>
            shown.length === 0 ? (
              <EmptyState title={t('m10.res.noMatch')} />
            ) : (
              <div data-testid="m10-challenges">
                <Grid cols={3}>
                  {shown.map((c) => (
                    <ChallengeCard key={c.id} c={c} action={cta} />
                  ))}
                </Grid>
              </div>
            )
          }
        </Async>
      </Section>
      <Section title={t('m10.res.processTitle')}>
        <Card>
          <Stepper current={-1} steps={['propose', 'screen', 'ip', 'decide'].map((x) => ({ id: x, label: t(`m10.res.step.${x}`) }))} />
          <Grid cols={2}>
            <ul className="mt-3 list-disc space-y-1 ps-5 text-[13px] text-ink-2">
              <li>{t('m10.res.rule1')}</li>
              <li>{t('m10.res.rule2')}</li>
              <li>{t('m10.res.rule3')}</li>
            </ul>
            <div className="mt-3 text-[13px] text-ink-2">
              <p>{t('m10.res.ipBody')}</p>
              <div className="mt-1"><MoetLink /></div>
            </div>
          </Grid>
        </Card>
      </Section>
    </Page>
  );
}

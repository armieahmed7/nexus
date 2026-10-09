// /my/development-priorities (M23 · F18, employee view): the development priorities agreed in a locked talent review. Employees
// never see their box, rating, potential or pool (the priorities row holds none of them: RLS own_profile Own on talent_priorities).
import { Page, Card, Async, EmptyState, Callout, Icon } from '../../ui';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, useT } from '../../i18n';
import { ActionKindPill } from './ui';
import type { DevAction } from './domain';

const linkFor = (a: DevAction): string | null => {
  if (a.ref_table === 'courses' && a.ref_id) return `/learn/course/${a.ref_id}`;
  if (a.ref_table === 'rotation_templates') return '/opportunities/rotations';
  if (a.ref_table === 'leadership_programmes' && a.ref_id) return `/leadership/programmes/${a.ref_id}`;
  if (a.kind === 'mentoring') return '/my/mentoring';
  if (a.kind === 'stretch') return '/opportunities';
  if (a.kind === 'training') return '/my/coach';
  return null;
};

export default function MyPrioritiesPage() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const me = useSession().identity.personId;
  const q = useQuery('talent_priorities', () => (me ? repo.list('talent_priorities', { filter: { person_id: me }, order: [['agreed_on', 'desc']] }) : Promise.resolve([] as RowOf<'talent_priorities'>[])), [me]);
  return (
    <Page title={t('m23.routes.my-development-priorities.title')} intro={t('m23.my.intro')}>
      <Callout title={t('m23.my.howTitle')}>{t('m23.my.howBody')}</Callout>
      <Async state={q} empty={<EmptyState icon="sparkle" title={t('m23.my.none')}>{t('m23.my.noneBody')}</EmptyState>} isEmpty={(d) => d.length === 0}>
        {(rows) => (
          <div className="space-y-4" data-testid="m23-my-priorities">
            {rows.map((r) => {
              const pr = (r.priorities as unknown as DevAction[]) ?? [];
              return (
                <Card key={r.id} eyebrow={<span className="num">{r.period}</span>} title={t('m23.my.agreed', { date: f.date(r.agreed_on) })}>
                  {pr.length === 0 ? <p className="text-[13px] text-ink-2">{t('m23.my.noActions')}</p> : (
                    <ul className="space-y-2">
                      {pr.map((a, i) => {
                        const to = linkFor(a);
                        return (
                          <li key={i} className="flex flex-wrap items-center gap-2 rounded-btn border border-line p-2 text-[13.5px]" data-testid="m23-my-priority">
                            <ActionKindPill kind={a.kind} />
                            <span className="min-w-0 flex-1">{lang === 'ar' ? a.title_ar : a.title_en}</span>
                            {to && <L to={to} className="btn-ghost btn-sm">{t('m23.my.open')}<Icon name="chevron" size={13} className="flip-rtl" /></L>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
            <p className="text-[12.5px] text-ink-3">{t('m23.my.footer')} <L to="/my/career/conversations">{t('m23.my.toConversations')}</L> · <L to="/my/coach">{t('m23.my.toCoach')}</L></p>
          </div>
        )}
      </Async>
    </Page>
  );
}

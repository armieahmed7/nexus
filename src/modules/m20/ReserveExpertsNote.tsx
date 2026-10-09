// W3 integration (F23 -> F17): the expert finder points to alumni and partner experts in the expert reserve. Staff read only
// members who opted into the finder (RLS on kafaa_alumni.finder_visible), so the count never includes anyone else.
import { useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { checkGuard } from '../../auth/guards';
import { ROUTES } from '../../routes/registry';
import { L, useFormat, useT } from '../../i18n';
import { Callout } from '../../ui';

export function ReserveExpertsNote({ skillId }: { skillId?: string | null }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const route = ROUTES.find((x) => x.path === '/opportunities/reserve');
  const allowed = !!route && checkGuard(route.guard, s) === 'ok';
  const q = useQuery('alumni', () => (allowed ? repo.list('alumni', { filter: { finder_visible: true, status: 'active' } }).catch(() => [] as RowOf<'alumni'>[]) : Promise.resolve([] as RowOf<'alumni'>[])), [allowed]);
  if (!allowed) return null;
  const all = (q.data ?? []).filter((m) => m.finder_visible && m.status === 'active');
  const match = skillId ? all.filter((m) => ((m.skill_snapshot as { skill_id: string }[] | null) ?? []).some((x) => x.skill_id === skillId)) : all;
  if (!all.length) return null;
  return (
    <div data-testid="m20-reserve-experts-note">
      <Callout tone="info" title={t('m20.res.finderNote.title')}>
        {skillId ? t('m20.res.finderNote.bodySkill', { n: f.num(match.length) }) : t('m20.res.finderNote.body', { n: f.num(all.length) })}{' '}
        <L to="/opportunities/reserve" className="link">{t('m20.res.finderNote.open')}</L>
      </Callout>
    </div>
  );
}

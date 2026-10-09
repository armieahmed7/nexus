// W3 integration: small M24 widgets other modules render (pages never import backend/*).
//  - ReadBeforeRequal (F21 -> M02): published knowledge assets attached to a qualification standard as "read before requal".
//  - KlraRoleLinks (F20 -> F19): the KLRA positions of a role, for viewers who may open the KLRA (knowledge A or Scope).
import { useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { checkGuard } from '../../auth/guards';
import { ROUTES } from '../../routes/registry';
import { L, usePick, useT } from '../../i18n';
import { Card, Icon } from '../../ui';
import { BandPill } from './ui';

/** Published assets whose requal_standard_ids include any of the given standard ids. Renders nothing when there are none. */
export function ReadBeforeRequal({ standardIds }: { standardIds: string[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const key = [...new Set(standardIds)].sort().join(',');
  const q = useQuery('knowledge_assets', () => repo.list('knowledge_assets', { filter: { published: true } }).catch(() => [] as RowOf<'knowledge_assets'>[]), [key]);
  const ids = new Set(key ? key.split(',') : []);
  const list = (q.data ?? []).filter((a) => a.status === 'published' && (a.requal_standard_ids ?? []).some((x) => ids.has(x)));
  if (!list.length) return null;
  return (
    <div data-testid="m24-read-before-requal"><Card title={t('m24.link.requalTitle')}>
      <p className="mb-2 text-[12.5px] text-ink-2">{t('m24.link.requalBody')}</p>
      <ul className="space-y-1.5">
        {list.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-[13.5px]">
            <Icon name="book" size={14} className="text-ink-3" />
            <L to={`/knowledge/assets/${a.id}`} className="link">{pick(a, 'title')}</L>
          </li>
        ))}
      </ul>
    </Card></div>
  );
}

/** KLRA positions for a role (F20), linked to their position page. Only for viewers whose role opens /knowledge/klra and who
 *  see rows (knowledge A or Scope); HR aggregate viewers get a link to the department heatmap instead. */
export function KlraRoleLinks({ roleId }: { roleId: string }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const route = ROUTES.find((x) => x.path === '/knowledge/klra');
  const allowed = !!route && checkGuard(route.guard, s) === 'ok';
  const q = useQuery(['klra_assessments', 'klra_positions', 'klra_actions', 'klra_settings'], async () => (allowed ? repo.rpc.klraRegister(null).catch(() => null) : null), [allowed]);
  if (!allowed) return null;
  const reg = q.data;
  const rows = (reg?.rows ?? []).filter((r) => r.position?.role_id === roleId).sort((a, b) => b.total - a.total);
  return (
    <div data-testid="m24-klra-role-links"><Card title={t('m24.link.klraTitle')}>
      {rows.length ? (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <BandPill band={r.band} />
              <L to={`/knowledge/klra/${r.position_id}`} className="link">{pick(r.position, 'title')}</L>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-2">{t('m24.link.klraNone')}</p>
      )}
      <L to="/knowledge/klra" className="link mt-2 inline-block text-[12.5px]">{t('m24.link.klraOpen')}</L>
    </Card></div>
  );
}

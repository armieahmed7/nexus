// FS wave E integration (QA lead): small M31 widgets other modules render (pages never import backend/*).
//  - NextGenLink (FS38 -> FS13/FS14 in M21 and the ADVANCE pages in M11): "what changes in my role on an SMR or advanced-reactor
//    fleet", linking /my/next-gen for staff who may open it and /careers/next-gen (public summary) for everyone else.
//  - TwinDrillRoutes (FS40 -> FS27 gig fg-dig-twin-validation and any gig whose skills a published twin drill evidences): the drills
//    as a practice route, for staff who may open /my/twin-drills. Rows come from the staff-readable twin_scenarios table.
//  - TwinLaneLink (FS40 -> FS14 lanes HZ-1 / HZ-7): a plain link to the drill list.
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { checkGuard } from '../../auth/guards';
import { ROUTES } from '../../routes/registry';
import { L, usePick, useT } from '../../i18n';
import { Icon, SimChip } from '../../ui';
import { twinDrillsFor } from './twin';

function useCanOpen(path: string): boolean {
  const s = useSession();
  const route = ROUTES.find((x) => x.path === path);
  return !!route && checkGuard(route.guard, s) === 'ok';
}

/** FS38 link: personal delta for staff (skills_profile Own), the public role-by-technology summary otherwise. Always says "no deployment decision implied". */
export function NextGenLink({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const mine = useCanOpen('/my/next-gen');
  const to = mine ? '/my/next-gen' : '/careers/next-gen';
  return (
    <div className="rounded-card border border-line bg-panel p-3 text-[13px]" data-testid="m31-next-gen-link" data-to={to}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="sparkle" size={14} className="text-accent" />
        <L to={to} className="font-semibold">{t(mine ? 'm31.link.mine' : 'm31.link.public')}</L>
      </div>
      {!compact && <p className="mt-1 text-ink-2">{t('m31.link.body')}</p>}
      <p className="mt-1 text-[12px] text-ink-3">{t('m31.link.noDecision')}</p>
    </div>
  );
}

/** FS40 link for horizon lanes: the digital-twin drill list (staff only). */
export function TwinLaneLink() {
  const t = useT();
  if (!useCanOpen('/my/twin-drills')) return null;
  return (
    <p className="text-[12.5px]" data-testid="m31-twin-lane-link">
      <Icon name="chart" size={12} /> <L to="/my/twin-drills">{t('m31.link.twinLane')}</L> <SimChip />
    </p>
  );
}

/** FS40 practice route on a gig: published twin drills that evidence the gig's skills (needed or gained). Nothing when none or not allowed. */
export function TwinDrillRoutes({ skillIds }: { skillIds: string[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const allowed = useCanOpen('/my/twin-drills');
  const key = [...new Set(skillIds)].sort().join(',');
  const q = useQuery('twin_scenarios', async () => (allowed ? repo.list('twin_scenarios', { filter: { status: 'published' } }).catch(() => []) : []), [allowed, key]);
  if (!allowed) return null;
  const list = twinDrillsFor((q.data ?? []) as never[], key ? key.split(',') : []) as unknown as Record<string, string>[];
  if (!list.length) return null;
  return (
    <div className="rounded-card border border-line p-3" data-testid="m31-twin-routes">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[13px] font-semibold"><Icon name="chart" size={14} /> {t('m31.link.twinTitle')} <SimChip /></div>
      <p className="mb-2 text-[12.5px] text-ink-2">{t('m31.link.twinBody')}</p>
      <ul className="space-y-1 text-[13px]">
        {list.map((d) => <li key={d.id}><L to={`/my/twin-drills/${d.id}`} data-testid="m31-twin-route">{pick(d, 'title')}</L> <span className="text-[11.5px] text-ink-3">{d.code}</span></li>)}
      </ul>
    </div>
  );
}

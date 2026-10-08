// M18 /team/career (F05/F06, manager view): the shortlists and roadmaps that people in my scope chose to share with me
// (RLS: skills_profile Scope, shared rows only), with each person's readiness for their targets from rpc.careerReadiness.
// Nothing unshared is ever shown; the page reads only what the repository returns.
import { useMemo } from 'react';
import { Page, Section, Async, EmptyState, StatusPill, Card, WhyThis, Callout } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat } from '../../i18n';
import { useSession } from '../../auth/session';
import { BandPill, GatePill, GateRoutes, ReadinessRing, useReadiness, type Role, type Target, type RoadmapRow } from './shared';

export default function TeamCareerPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.person?.id ?? null;
  const q = useQuery(['career_targets', 'roadmaps', 'people', 'job_roles'], async () => {
    const [targets, roadmaps, people, roles] = await Promise.all([
      repo.list('career_targets', { filter: { shared: true, active: true } }),
      repo.list('roadmaps', { filter: { shared: true, active: true } }),
      repo.list('people'),
      repo.list('job_roles'),
    ]);
    const mine = (x: { person_id: string }) => x.person_id !== me;
    return { targets: targets.filter(mine), roadmaps: roadmaps.filter(mine), people: new Map(people.map((p) => [p.id, p])), roleById: new Map(roles.map((r) => [r.id, r])) };
  }, [me]);
  return (
    <Page title={t('m18.routes.team-career.title')} intro={t('m18.team.intro')}>
      <Callout tone="info">{t('m18.team.privacy')}</Callout>
      <Async state={q}>
        {(d) => {
          const ids = [...new Set([...d.targets.map((x) => x.person_id), ...d.roadmaps.map((x) => x.person_id)])].sort((a, b) => (d.people.get(a)?.display_name ?? a).localeCompare(d.people.get(b)?.display_name ?? b));
          return ids.length === 0 ? (
            <EmptyState title={t('m18.team.none')} icon="users">{t('m18.team.noneBody')}</EmptyState>
          ) : (
            <ul className="space-y-4" data-testid="m18-team">
              {ids.map((pid) => (
                <Person key={pid} pid={pid} name={d.people.get(pid)} roleById={d.roleById} targets={d.targets.filter((x) => x.person_id === pid).sort((a, b) => a.rank - b.rank)} roadmaps={d.roadmaps.filter((x) => x.person_id === pid)} />
              ))}
            </ul>
          );
        }}
      </Async>
    </Page>
  );
}

function Person({ pid, name, roleById, targets, roadmaps }: { pid: string; name?: { display_name: string; display_name_ar: string; job_role_id?: string | null }; roleById: Map<string, Role>; targets: Target[]; roadmaps: RoadmapRow[] }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const roleIds = useMemo(() => [...new Set([...targets.map((x) => x.role_id), ...roadmaps.map((x) => x.target_role_id)])], [targets, roadmaps]);
  const rd = useReadiness(pid, roleIds);
  return (
    <li className="card p-4" data-testid="m18-team-person" data-person={pid}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold">{pick({ n_en: name?.display_name ?? pid, n_ar: name?.display_name_ar || name?.display_name || pid }, 'n')}</h2>
          {name?.job_role_id && <div className="text-[12.5px] text-ink-2">{pick(roleById.get(name.job_role_id), 'title')}</div>}
        </div>
        <StatusPill tone="info">{t('m18.team.shared')}</StatusPill>
      </div>
      <Async state={rd}>
        {(m) => (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roleIds.map((rid) => {
              const r = m.get(rid);
              const rm = roadmaps.find((x) => x.target_role_id === rid);
              return (
                <Card key={rid} title={pick(roleById.get(rid), 'title')} eyebrow={targets.some((x) => x.role_id === rid) ? t('m18.team.target') : t('m18.team.roadmapOnly')}>
                  {r ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <ReadinessRing r={r} size={48} />
                        <div className="flex flex-wrap gap-1.5"><BandPill r={r} />{!r.path_only && <GatePill status={r.gate_status} />}</div>
                      </div>
                      {rm && <div className="text-[12.5px] text-ink-2">{t('m18.team.roadmap', { name: rm.name, date: f.date(rm.end_on) })}</div>}
                      <WhyThis reasons={r.reasons} testId="m18-team-why" />
                      {!r.path_only && r.routes[0] && <GateRoutes routes={[r.routes[0]]} roleById={roleById} compact />}
                    </div>
                  ) : (
                    <p className="text-ink-3">—</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Async>
    </li>
  );
}

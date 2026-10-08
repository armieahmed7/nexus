// M18 /my/career (F05 Career Navigator): "Where can I go from here?" A personal opportunity map centred on my role, readiness per
// role from my own skill state (rpc.careerReadiness: weighted coverage, gates shown separately), role cards with the top gaps and
// the courses that close them, "roles like mine" (cosine similarity of role skill vectors) and a shortlist of up to three targets
// that drives the roadmap (F06). Every suggestion carries its reasons (<WhyThis>). Indicative guidance; ENEC and FANR decide.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatusPill, StatTile, Grid, Drawer, Icon, CheckboxField, WhyThis, EngineBadge } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine'; // direct import: avoids a circular chunk warning in the build
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { reachableRoles, type CareerReadiness, type Reason } from './career';
import { BandPill, GatePill, GateRoutes, OpportunityMap, ReadinessRing, useArrow, useCareerBase, useReadiness, type CareerBase, type MapEdge, type MapNode } from './shared';

const MAX_TARGETS = 3;

export default function MyCareerPage() {
  const t = useT();
  const s = useSession();
  const me = s.person?.id ?? null;
  const base = useCareerBase(me);
  const eng = useEngine('recommend');
  return (
    <Page title={t('m18.routes.my-career.title')} intro={t('m18.nav.intro')} actions={<><EngineBadge engine={eng} /><L to="/my/career/roadmap" className="btn-outline btn-sm" data-testid="m18-to-roadmap"><Icon name="calendar" size={14} />{t('m18.nav.toRoadmap')}</L></>}>
      <Async state={base}>
        {(d) =>
          !d.facts?.role_id ? (
            <EmptyState title={t('m18.nav.noRole')} icon="briefcase" action={<L to="/careers" className="btn-outline btn-sm">{t('m18.nav.browseCareers')}</L>}>
              {t('m18.nav.noRoleBody')}
            </EmptyState>
          ) : (
            <Navigator d={d} me={me!} />
          )
        }
      </Async>
    </Page>
  );
}

function Navigator({ d, me }: { d: CareerBase; me: string }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const eng = useEngine('recommend');
  const repo = useRepo();
  const act = useAction();
  const arrow = useArrow();
  const myRole = d.facts!.role_id!;
  const [selected, setSelected] = useState<string | null>(null);
  const security = useMemo(() => d.roles.filter((r) => r.security_sensitive).map((r) => r.id), [d.roles]);
  const have = useMemo(() => eng.skills.competencyLevels(d.states as never, d.skills), [eng, d.states, d.skills]);
  const roleLabels = useMemo(() => Object.fromEntries(d.roles.map((r) => [r.id, { en: r.title_en, ar: r.title_ar }])), [d.roles]);
  const compLabels = useMemo(() => Object.fromEntries(d.competencies.flatMap((c) => [[c.id, { en: c.name_en, ar: c.name_ar }], [`sk-${c.id}`, { en: c.name_en, ar: c.name_ar }]])), [d.competencies]);
  const reach = useMemo(() => reachableRoles(d.edges as never, myRole, 2), [d.edges, myRole]);
  const moves = useMemo(() => eng.rank.careerMoves({ from: myRole, edges: d.edges as never, roleComps: d.roleComps, have, maxSteps: 2, pathOnly: security, labels: roleLabels }), [eng, myRole, d.edges, d.roleComps, have, security, roleLabels]);
  const similar = useMemo(() => {
    const mine = eng.skills.roleVector(d.roleComps, myRole);
    const cands = d.roles.filter((r) => r.id !== myRole && !reach.has(r.id) && !r.security_sensitive).map((r) => ({ id: r.id, vec: eng.skills.roleVector(d.roleComps, r.id) }));
    return eng.rank.byCosine(mine, cands, { min: 0.35, labels: compLabels }).slice(0, 4);
  }, [eng, d.roleComps, d.roles, myRole, reach, compLabels]);
  const active = d.targets.filter((x) => x.active).sort((a, b) => a.rank - b.rank);
  const ids = useMemo(() => [...new Set([myRole, ...reach.keys(), ...similar.map((x) => x.id), ...active.map((x) => x.role_id)])], [myRole, reach, similar, active]);
  const ready = useReadiness(me, ids);
  const doneCourses = useMemo(() => new Set(d.trainingRecords.filter((x) => x.result === 'passed' || x.result === 'completed').map((x) => x.course_id)), [d.trainingRecords]);
  const closing = (roleId: string) => {
    const courses = d.courses.filter((c) => c.audience === 'staff' && !doneCourses.has(c.id)) as { id: string; competency_ids: string[]; qualifying: boolean; duration_hours: number | null; title_en: string; title_ar: string }[];
    return eng.rank.coursesForGaps({ have, currentRole: null, targets: [roleId], roleComps: d.roleComps, courses, labels: compLabels, roleLabels });
  };

  // ── shortlist writes (direct, own rows)
  const sharedNow = active.length > 0 && active.every((x) => x.shared);
  const addTarget = async (roleId: string) => {
    if (active.some((x) => x.role_id === roleId)) return;
    if (active.length >= MAX_TARGETS) return act(async () => ({ ok: false, code: 'full', message: t('m18.short.full') }));
    const id = `ct:${me}:${roleId}`;
    const now = new Date().toISOString();
    const existing = d.targets.find((x) => x.id === id);
    const row = { active: true, rank: active.length + 1, shared: sharedNow, shared_person_id: sharedNow ? me : null, updated_at: now };
    return act(() => (existing ? repo.update('career_targets', id, row) : repo.insert('career_targets', { id, person_id: me, role_id: roleId, created_at: now, ...row })), { success: t('m18.short.added') });
  };
  const removeTarget = async (id: string) => {
    const r = await act(() => repo.update('career_targets', id, { active: false, updated_at: new Date().toISOString() }), { success: t('m18.short.removed') });
    if (r.ok) {
      const rest = active.filter((x) => x.id !== id);
      for (const [i, x] of rest.entries()) if (x.rank !== i + 1) await repo.update('career_targets', x.id, { rank: i + 1 });
    }
  };
  const move = async (i: number, dir: -1 | 1) => {
    const a = active[i], b = active[i + dir];
    if (!a || !b) return;
    await repo.update('career_targets', a.id, { rank: b.rank });
    await act(() => repo.update('career_targets', b.id, { rank: a.rank }), { success: t('m18.short.reordered') });
  };
  const setShared = async (v: boolean) => {
    for (const x of active.slice(0, -1)) await repo.update('career_targets', x.id, { shared: v, shared_person_id: v ? me : null });
    const last = active[active.length - 1];
    if (last) await act(() => repo.update('career_targets', last.id, { shared: v, shared_person_id: v ? me : null }), { success: v ? t('m18.short.sharedOn') : t('m18.short.sharedOff') });
  };

  const role = d.roleById.get(myRole);
  const f0 = d.facts!;
  return (
    <Async state={ready}>
      {(rd) => {
        const rs = (id: string) => rd.get(id) ?? null;
        const nodes: MapNode[] = [
          { id: myRole, label: pick(role, 'title'), steps: 0, r: rs(myRole), security: false },
          ...[...reach].sort((a, b) => a[1] - b[1] || (rs(b[0])?.score ?? -1) - (rs(a[0])?.score ?? -1)).map(([id, n]) => ({ id, label: pick(d.roleById.get(id), 'title'), steps: n as 1 | 2, r: rs(id), security: security.includes(id) })),
        ];
        const inMap = new Set(nodes.map((n) => n.id));
        const mapEdges: MapEdge[] = d.edges.filter((e) => e.from_role_id && inMap.has(e.from_role_id) && inMap.has(e.to_role_id) && (reach.get(e.to_role_id) ?? 0) === (e.from_role_id === myRole ? 1 : (reach.get(e.from_role_id) ?? 9) + 1)).map((e) => ({ from: e.from_role_id!, to: e.to_role_id, type: e.type }));
        const readyNow = [...reach.keys()].filter((id) => rs(id)?.band === 'ready_now').length;
        const best = moves.find((m) => !security.includes(m.id));
        const sel = selected ? rs(selected) : null;
        return (
          <>
            <Grid cols={4}>
              <StatTile label={t('m18.nav.youAre')} value={<span className="text-[18px]">{pick(role, 'title')}</span>} sub={f0.role_since ? t(`m18.nav.since.${f0.role_since_basis}`, { n: f.num(f0.months_in_role), date: f.date(f0.role_since) }) : t('m18.nav.notQualifiedYet')} />
              <StatTile label={t('m18.nav.within')} value={f.num(reach.size)} sub={t('m18.nav.withinSub')} />
              <StatTile label={t('m18.nav.readyNow')} value={f.num(readyNow)} tone={readyNow ? 'ok' : undefined} sub={t('m18.nav.readyNowSub')} />
              <StatTile label={t('m18.nav.shortlist')} value={`${f.num(active.length)} / ${f.num(MAX_TARGETS)}`} sub={best ? t('m18.nav.topMove', { role: pick(d.roleById.get(best.id), 'title') }) : undefined} />
            </Grid>

            <Section title={t('m18.map.title')} description={t('m18.map.desc')}>
              {reach.size === 0 ? (
                <Callout tone="info" title={t('m18.map.noneTitle')}>{t('m18.map.noneBody')}</Callout>
              ) : (
                <OpportunityMap nodes={nodes} edges={mapEdges} onSelect={setSelected} selected={selected} />
              )}
            </Section>

            {reach.size > 0 && (
              <Section title={t('m18.moves.title')} description={t('m18.moves.desc')}>
                <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m18-moves">
                  {moves.map((m) => {
                    const r = rs(m.id);
                    return <RoleCard key={m.id} d={d} roleId={m.id} r={r} reasons={[...m.reasons.filter((x) => x.code !== 'readiness'), ...(r?.reasons ?? [])]} steps={m.item?.steps ?? 1} type={m.item?.type ?? 'lateral'} path={m.item?.path ?? []}
                      closing={r && !r.path_only ? closing(m.id) : []} onOpen={() => setSelected(m.id)} shortlisted={active.some((x) => x.role_id === m.id)} canAdd={active.length < MAX_TARGETS} onAdd={() => addTarget(m.id)} myRole={myRole} arrow={arrow} />;
                  })}
                </ul>
              </Section>
            )}

            <Section title={t('m18.similar.title')} description={t('m18.similar.desc')}>
              {similar.length === 0 ? (
                <EmptyState title={t('m18.similar.none')} />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="m18-similar">
                  {similar.map((x) => {
                    const r = rs(x.id);
                    return (
                      <li key={x.id} className="card flex items-start gap-3 p-3" data-testid="m18-similar-item">
                        {r && <ReadinessRing r={r} size={48} />}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{pick(d.roleById.get(x.id), 'title')}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1.5">
                            <StatusPill tone="info">{t('m18.similar.match', { pct: f.num(Math.round(x.score * 100)) })}</StatusPill>
                            {r && <BandPill r={r} />}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <WhyThis reasons={[...x.reasons, ...(r?.reasons ?? []).filter((z) => z.code !== 'readiness')]} testId="m18-similar-why" />
                            <button className="btn-ghost btn-sm" onClick={() => setSelected(x.id)}>{t('m18.card.details')}</button>
                            {!active.some((z) => z.role_id === x.id) && active.length < MAX_TARGETS && (
                              <button className="btn-ghost btn-sm" onClick={() => addTarget(x.id)} data-testid="m18-add-target"><Icon name="plus" size={13} />{t('m18.card.shortlist')}</button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title={t('m18.short.title')} description={t('m18.short.desc', { n: f.num(MAX_TARGETS) })}>
              <Card>
                {active.length === 0 ? (
                  <EmptyState title={t('m18.short.empty')} icon="sparkle">{t('m18.short.emptyBody')}</EmptyState>
                ) : (
                  <>
                    <ol className="divide-y divide-line" data-testid="m18-shortlist">
                      {active.map((x, i) => {
                        const r = rs(x.role_id);
                        return (
                          <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
                            <span className="num grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-eyebrow">{f.num(i + 1)}</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold">{pick(d.roleById.get(x.role_id), 'title')}</div>
                              <div className="mt-0.5 flex flex-wrap gap-1.5">{r && <BandPill r={r} />}{r && !r.path_only && <GatePill status={r.gate_status} />}{r?.pct != null && <StatusPill tone="neutral">{f.pct(r.pct, 0)}</StatusPill>}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <button className="btn-ghost btn-sm" aria-label={t('m18.short.up')} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="chevronDown" size={14} className="rotate-180" /></button>
                              <button className="btn-ghost btn-sm" aria-label={t('m18.short.down')} disabled={i === active.length - 1} onClick={() => move(i, 1)}><Icon name="chevronDown" size={14} /></button>
                              <L to={`/my/career/roadmap?role=${x.role_id}`} className="btn-outline btn-sm" data-testid="m18-short-roadmap">{t('m18.short.roadmap')}</L>
                              <button className="btn-ghost btn-sm" onClick={() => removeTarget(x.id)} data-testid="m18-short-remove">{t('m18.short.remove')}</button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <div className="mt-3 border-t border-line pt-3" data-testid="m18-share">
                      <CheckboxField label={t('m18.short.share')} hint={t('m18.short.shareHint')} checked={sharedNow} onChange={setShared} />
                    </div>
                  </>
                )}
              </Card>
            </Section>

            <p className="text-[12.5px] text-ink-3" data-testid="m18-disclaimer">{t('m18.disclaimer')}</p>

            <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? pick(d.roleById.get(selected), 'title') : ''}>
              {selected && <RoleDetail d={d} roleId={selected} r={sel} closing={sel && !sel.path_only ? closing(selected) : []} />}
            </Drawer>
          </>
        );
      }}
    </Async>
  );
}

type Closing = ReturnType<ReturnType<typeof useEngine>['rank']['coursesForGaps']>;

function RoleCard(p: { d: CareerBase; roleId: string; r: CareerReadiness | null; reasons: Reason[]; steps: number; type: string; path: string[]; closing: Closing; onOpen: () => void; shortlisted: boolean; canAdd: boolean; onAdd: () => void; myRole: string; arrow: string }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const role = p.d.roleById.get(p.roleId);
  const months = p.path.reduce((s, to, i) => {
    const from = i === 0 ? p.myRole : p.path[i - 1];
    const e = p.d.edges.find((x) => x.from_role_id === from && x.to_role_id === to);
    const c = Array.isArray(e?.conditions) ? (e!.conditions as { kind: string; value: unknown }[]) : [];
    return s + c.reduce((m, x) => (x.kind === 'months' && typeof x.value === 'number' ? Math.max(m, x.value) : m), 0);
  }, 0);
  return (
    <li className="card flex flex-col gap-3 p-4" data-testid="m18-move" data-role={p.roleId}>
      <div className="flex items-start gap-3">
        {p.r && <ReadinessRing r={p.r} />}
        <div className="min-w-0 flex-1">
          <div className="caps">{t(`m18.edgeType.${p.type}`)} · {t('m18.card.steps', { n: f.num(p.steps) })}</div>
          <h3 className="text-[16px] font-semibold leading-snug">{pick(role, 'title')}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {p.r && <BandPill r={p.r} />}
            {p.r && !p.r.path_only && <GatePill status={p.r.gate_status} />}
            {months > 0 && <StatusPill tone="neutral">{t('m18.card.typical', { n: f.num(months) })}</StatusPill>}
          </div>
          {p.path.length > 1 && <div className="mt-1 text-[12px] text-ink-2">{[p.myRole, ...p.path].map((id) => pick(p.d.roleById.get(id), 'title')).join(` ${p.arrow} `)}</div>}
        </div>
      </div>
      {p.r?.path_only ? (
        <Callout tone="info">{t('m18.pathOnlyHint')}</Callout>
      ) : p.r && p.r.gaps.length > 0 ? (
        <div>
          <div className="caps mb-1">{t('m18.card.topGaps')}</div>
          <ul className="space-y-1.5 text-[13px]" data-testid="m18-gaps">
            {p.r.gaps.slice(0, 3).map((g) => {
              const c = p.d.compById.get(g.competency_id);
              const course = p.closing.find((x) => x.item && (x.item.competency_ids ?? []).includes(g.competency_id))?.item as { id: string; title_en: string; title_ar: string; duration_hours: number | null } | undefined;
              return (
                <li key={g.competency_id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{pick(c, 'name')}</span>
                  <span className="num text-ink-3">{t('m18.card.level', { from: f.num(g.have), to: f.num(g.need) })}</span>
                  {course && (
                    <L to={`/learn/course/${course.id}`} className="text-[12.5px]" data-testid="m18-closing-course">
                      {t('m18.card.closeWith', { course: pick(course, 'title') })}{course.duration_hours ? ` · ${t('m18.card.hours', { n: f.num(Number(course.duration_hours)) })}` : ''}
                    </L>
                  )}
                </li>
              );
            })}
          </ul>
          <L to="/my/coach" className="mt-1 inline-block text-[12.5px]" data-testid="m18-coach-link">{t('m18.card.coachLink')}</L>
        </div>
      ) : p.r ? (
        <p className="text-[13px] text-ok">{t('m18.card.noGaps')}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <WhyThis reasons={p.reasons} testId="m18-why" />
        <button className="btn-ghost btn-sm" onClick={p.onOpen} data-testid="m18-details">{t('m18.card.details')}</button>
        {p.shortlisted ? (
          <StatusPill tone="accent"><Icon name="check" size={12} className="me-1 inline" />{t('m18.card.shortlisted')}</StatusPill>
        ) : (
          <button className="btn-outline btn-sm" disabled={!p.canAdd} title={!p.canAdd ? t('m18.short.full') : undefined} onClick={p.onAdd} data-testid="m18-add-target"><Icon name="plus" size={13} />{t('m18.card.shortlist')}</button>
        )}
        {!p.r?.path_only && <L to={`/my/career/roadmap?role=${p.roleId}`} className="btn-ghost btn-sm">{t('m18.card.roadmap')}</L>}
      </div>
    </li>
  );
}

function RoleDetail({ d, roleId, r, closing }: { d: CareerBase; roleId: string; r: CareerReadiness | null; closing: Closing }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  if (!r) return <p className="text-ink-2">{t('m18.detail.loading')}</p>;
  return (
    <div className="space-y-5" data-testid="m18-detail">
      <div className="flex items-center gap-4">
        <ReadinessRing r={r} size={72} />
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5"><BandPill r={r} />{!r.path_only && <GatePill status={r.gate_status} />}</div>
          <p className="text-[13px] text-ink-2">{r.path_only ? t('m18.pathOnlyHint') : t('m18.detail.readinessNote')}</p>
          <WhyThis reasons={r.reasons} testId="m18-detail-why" />
        </div>
      </div>
      {!r.path_only && (
        <>
          <div>
            <h3 className="mb-2 font-semibold">{t('m18.detail.gates')}</h3>
            <p className="mb-2 text-[12.5px] text-ink-2">{t('m18.detail.gatesNote')}</p>
            <GateRoutes routes={r.routes} roleById={d.roleById} />
          </div>
          <div>
            <h3 className="mb-2 font-semibold">{t('m18.detail.gaps', { n: f.num(r.gaps.length) })}</h3>
            {r.gaps.length === 0 ? (
              <p className="text-[13px] text-ok">{t('m18.card.noGaps')}</p>
            ) : (
              <table className="table-base w-full text-[13px]" data-testid="m18-detail-gaps">
                <thead><tr><th className="text-start">{t('m18.detail.competency')}</th><th className="text-start">{t('m18.detail.have')}</th><th className="text-start">{t('m18.detail.need')}</th><th className="text-start">{t('m18.detail.close')}</th></tr></thead>
                <tbody>
                  {r.gaps.map((g) => {
                    const course = closing.find((x) => x.item && (x.item.competency_ids ?? []).includes(g.competency_id))?.item as { id: string; title_en: string; title_ar: string } | undefined;
                    return (
                      <tr key={g.competency_id}>
                        <td>{pick(d.compById.get(g.competency_id), 'name')} <span className="text-[11px] text-ink-3">· {t(`m18.importance.${g.importance}`)}</span></td>
                        <td className="num">{f.num(g.have)}</td>
                        <td className="num">{f.num(g.need)}</td>
                        <td>{course ? <L to={`/learn/course/${course.id}`}>{pick(course, 'title')}</L> : <span className="text-ink-3">{t('m18.detail.onTheJob')}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <L to={`/careers/roles/${roleId}`} className="btn-outline btn-sm">{t('m18.detail.rolePage')}</L>
        {!r.path_only && <L to={`/my/career/roadmap?role=${roleId}`} className="btn-primary btn-sm" data-testid="m18-detail-roadmap">{t('m18.card.roadmap')}</L>}
      </div>
    </div>
  );
}

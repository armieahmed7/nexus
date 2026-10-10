// FS05 /careers/horizons: "Roles in 2030 and 2035". Every current role's now/2030/2035 profile and every concept future role,
// with what changes (new and raised requirements), the technology drivers and how many roles ask for digital and AI skills at
// each horizon. Counts are of roles, never of people (no headcount). Public: published versions only (RLS); the training
// manager, admins, instructors (SAT review) and auditors also see drafts awaiting review.
import { useMemo } from 'react';
import { Page, Section, Card, Grid, Async, StatTile, BarChart, Heatmap, StatusPill, Icon, FilterBar, useFilters } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useCareerData, GROUPS, type CareerData } from './shared';
import { BenchmarkChips, PlanningNotice, useProfileData, useCanEditProfiles, type ProfileData } from './horizons';
import { DRIVERS, HORIZONS, asksDigital, changeSize, publishedByHorizon, reqsOf, type Horizon } from './roleProfiles';

export default function CareersHorizonsPage() {
  const t = useT();
  const c = useCareerData();
  const p = useProfileData();
  return (
    <Page
      title={t('m01.routes.careers-horizons.title')}
      eyebrow={t('m01.fs05.overview.eyebrow')}
      intro={t('m01.fs05.overview.intro')}
      wide
      actions={
        <L to="/careers/paths?view=future" className="btn-outline" data-testid="m01-horizons-to-graph">
          {t('m01.fs05.overview.toGraph')}
        </L>
      }
    >
      <PlanningNotice />
      <BenchmarkChips />
      <Async state={c}>{(cd) => <Async state={p}>{(pd) => <Overview c={cd} p={pd} />}</Async>}</Async>
    </Page>
  );
}

function Overview({ c, p }: { c: CareerData; p: ProfileData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const canEdit = useCanEditProfiles();
  const [flt, setFlt] = useFilters({ group: '', q: '' }, true);
  const m = useMemo(() => {
    const byRole = new Map([...c.roles, ...c.concepts].map((r) => [r.id, publishedByHorizon(p.versions, r.id)]));
    const digital = (h: Horizon, ai = false) => c.roles.filter((r) => asksDigital(reqsOf(byRole.get(r.id)?.[h]), p.skillArea, p.compDomain, ai)).length;
    const conceptOk = c.concepts.filter((r) => {
      const v = byRole.get(r.id)!;
      const latest = v['2035'] ?? v['2030'];
      return reqsOf(latest).length >= 4 && c.futurePaths.some((e) => e.to_role_id === r.id);
    }).length;
    const drivers = (h: Horizon) => DRIVERS.map((d) => ({ label: t(`m01.fs05.driver.${d}`), value: c.roles.filter((r) => (byRole.get(r.id)?.[h]?.drivers ?? []).includes(d)).length }));
    return {
      byRole,
      with2030: c.roles.filter((r) => byRole.get(r.id)?.['2030']).length,
      conceptOk,
      digital: HORIZONS.map((h) => digital(h)),
      ai: HORIZONS.map((h) => digital(h, true)),
      drivers30: drivers('2030'),
      drivers35: drivers('2035'),
      drafts: p.versions.filter((v) => v.status === 'draft'),
      superseded: p.versions.filter((v) => v.status === 'superseded').length,
    };
  }, [c, p, t]);
  const term = flt.q.trim().toLowerCase();
  const roles = c.roles.filter((r) => (!flt.group || c.familyById.get(r.family_id)?.grp === flt.group) && (!term || `${r.title_en} ${r.title_ar}`.toLowerCase().includes(term)));
  const cell = (roleId: string, h: Horizon) => {
    const v = m.byRole.get(roleId);
    const prev = HORIZONS[HORIZONS.indexOf(h) - 1];
    return changeSize(reqsOf(prev ? v?.[prev] : undefined), reqsOf(v?.[h]));
  };
  const hLabel = (h: string) => t(`m01.fs05.h.${h}`);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m01-horizons-tiles">
        <StatTile label={t('m01.fs05.overview.with2030')} value={`${f.num(m.with2030)} / ${f.num(c.roles.length)}`} sub={t('m01.fs05.overview.with2030Sub')} tone="ok" />
        <StatTile label={t('m01.fs05.overview.concepts')} value={`${f.num(m.conceptOk)} / ${f.num(c.concepts.length)}`} sub={t('m01.fs05.overview.conceptsSub')} tone="info" />
        <StatTile label={t('m01.fs05.overview.digital')} value={`${f.num(m.digital[0])} → ${f.num(m.digital[2])}`} sub={t('m01.fs05.overview.digitalSub', { now: f.num(m.digital[0]), y30: f.num(m.digital[1]), y35: f.num(m.digital[2]) })} />
        <StatTile label={t('m01.fs05.overview.ai')} value={`${f.num(m.ai[0])} → ${f.num(m.ai[2])}`} sub={t('m01.fs05.overview.aiSub', { now: f.num(m.ai[0]), y30: f.num(m.ai[1]), y35: f.num(m.ai[2]) })} />
      </div>

      <Grid cols={2}>
        <Card title={t('m01.fs05.overview.digitalChart')}>
          <BarChart title={t('m01.fs05.overview.digitalChart')} max={c.roles.length} data={HORIZONS.map((h, i) => ({ label: hLabel(h), value: m.digital[i] }))} />
          <div className="mt-3">
            <BarChart title={t('m01.fs05.overview.aiChart')} max={c.roles.length} data={HORIZONS.map((h, i) => ({ label: `${t('m01.fs05.overview.aiShort')} · ${hLabel(h)}`, value: m.ai[i] }))} />
          </div>
        </Card>
        <Card title={t('m01.fs05.overview.driversTitle')}>
          <BarChart title={`${t('m01.fs05.overview.driversTitle')} · ${hLabel('2030')}`} max={c.roles.length} data={m.drivers30} />
          <div className="mt-3">
            <BarChart title={`${t('m01.fs05.overview.driversTitle')} · ${hLabel('2035')}`} max={c.roles.length} data={m.drivers35} />
          </div>
        </Card>
      </Grid>

      <Section title={t('m01.fs05.overview.mapTitle')} description={t('m01.fs05.overview.mapDesc')}>
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[{ key: 'group', label: t('m01.fs05.overview.group'), options: GROUPS.map((g) => ({ value: g, label: t(`m01.groups.${g}`) })) }]}
        />
        <div data-testid="m01-horizons-heatmap">
          <Heatmap
            title={t('m01.fs05.overview.mapTitle')}
            rows={roles.map((r) => r.id)}
            cols={['2030', '2035']}
            rowLabel={(id) => pick(c.roleById.get(id), 'title')}
            colLabel={(h) => t('m01.fs05.overview.vsPrev', { h: hLabel(h) })}
            value={(id, h) => {
              const role = c.roleById.get(id);
              if (role?.security_sensitive) return { v: null, tone: 'neutral', label: t('m01.fs05.overview.pathOnly') };
              const x = cell(id, h as Horizon);
              return { v: x.score, tone: x.score >= 6 ? 'bad' : x.score >= 3 ? 'sim' : 'info', label: t('m01.fs05.overview.cell', { added: f.num(x.added), raised: f.num(x.raised) }) };
            }}
          />
        </div>
        <p className="text-[12.5px] text-ink-3">{t('m01.fs05.overview.scoreNote')}</p>
      </Section>

      <Section title={t('m01.fs05.overview.tableTitle')}>
        <div className="card overflow-x-auto p-0">
          <table className="table-base w-full" data-testid="m01-horizons-table">
            <thead>
              <tr>
                <th className="text-start">{t('m01.fs05.overview.role')}</th>
                {HORIZONS.map((h) => (
                  <th key={h} className="text-start">
                    {hLabel(h)}
                  </th>
                ))}
                <th className="text-start">{t('m01.fs05.panel.drivers')}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const v = m.byRole.get(r.id) ?? {};
                return (
                  <tr key={r.id}>
                    <td>
                      <L to={`/careers/roles/${r.id}?tab=horizons`}>{pick(r, 'title')}</L>
                    </td>
                    {HORIZONS.map((h) => {
                      const x = v[h];
                      if (!x) return <td key={h} className="text-ink-3">—</td>;
                      if (x.path_only) return <td key={h}><StatusPill tone="neutral">{t('m01.fs05.overview.pathOnly')}</StatusPill></td>;
                      const s = h === 'now' ? null : cell(r.id, h);
                      return (
                        <td key={h} className="num whitespace-nowrap">
                          {t('m01.fs05.overview.reqs', { n: f.num(reqsOf(x).length) })}
                          {s && (s.added || s.raised) ? <span className="ms-1 text-[12px] text-ok">{t('m01.fs05.overview.delta', { added: f.num(s.added), raised: f.num(s.raised) })}</span> : null}
                        </td>
                      );
                    })}
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(v['2035']?.drivers ?? v['2030']?.drivers ?? []).map((d) => (
                          <StatusPill key={d} tone="accent">
                            {t(`m01.fs05.driver.${d}`)}
                          </StatusPill>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t('m01.fs05.overview.conceptTitle')} description={t('m01.fs05.overview.conceptDesc')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m01-horizons-concepts">
          {c.concepts.map((r) => {
            const v = m.byRole.get(r.id) ?? {};
            const latest = v['2035'] ?? v['2030'];
            const from = c.futurePaths.filter((e) => e.to_role_id === r.id).map((e) => c.roleById.get(e.from_role_id!));
            return (
              <Card as="li" key={r.id}>
                <div className="caps mb-1">
                  {pick(c.familyById.get(r.family_id), 'name')} · {t('m01.fs05.concept.pill')}
                </div>
                <h3 className="text-[15px] font-semibold leading-snug">
                  <L to={`/careers/roles/${r.id}`}>{pick(r, 'title')}</L>
                </h3>
                <p className="mt-1 text-[12.5px] text-ink-2">
                  {t('m01.fs05.overview.conceptReqs', { n: f.num(reqsOf(latest).length), h: latest ? hLabel(latest.horizon) : '—' })}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-[12px]">
                  <span className="text-ink-3">{t('m01.fs05.overview.from')}</span>
                  {from.map((x) => x && (
                    <span key={x.id} className="chip border-line bg-sunken">
                      {pick(x, 'title')}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </ul>
      </Section>

      <Grid cols={2}>
        <Card title={t('m01.fs05.method.title')}>
          <ol className="space-y-2 text-[13.5px]" data-testid="m01-method">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="flex gap-2">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-eyebrow">{f.num(i)}</span>
                <span>{t(`m01.fs05.method.s${i}`)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title={t('m01.fs05.review.title')}>
          {m.drafts.length === 0 ? (
            <p className="text-[13.5px] text-ink-2">{t('m01.fs05.review.none', { n: f.num(m.superseded) })}</p>
          ) : (
            <ul className="space-y-2" data-testid="m01-drafts">
              {m.drafts.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line p-2 text-[13px]">
                  <span>
                    {pick(c.anyRoleById.get(d.role_id), 'title')} · {hLabel(d.horizon)} · {t('m01.fs05.panel.version', { n: f.num(d.version) })}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusPill status="draft" />
                    {canEdit && (
                      <L to={`/careers/roles/${d.role_id}/profile?h=${d.horizon}`} className="btn-outline btn-sm">
                        <Icon name="chevron" size={12} className="me-1 inline rtl:-scale-x-100" />
                        {t('m01.fs05.review.open')}
                      </L>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Grid>
    </>
  );
}

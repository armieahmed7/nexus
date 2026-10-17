// M01 /careers/compare?roles=a,b,c: side-by-side comparison of up to three roles (basis, regulation, education,
// qualifications, training path, licensing body, entry routes, next roles, competency levels). Public data only.
import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Async, EmptyState, StatusPill, SelectField, Icon, Card } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L, useFormat, useRefText } from '../../i18n';
import { useCareerData, RoleBadges, type CareerData } from './shared';
import { neighbours, parseCompare } from './careerGraph';

export default function CareersComparePage() {
  const t = useT();
  const q = useCareerData();
  return (
    <Page title={t('m01.routes.careers-compare.title')} intro={t('m01.compare.intro')} wide>
      <Async state={q}>{(d) => <Compare data={d} />}</Async>
    </Page>
  );
}

function Compare({ data }: { data: CareerData }) {
  const t = useT();
  const pick = usePick();
  const refText = useRefText();
  const f = useFormat();
  const repo = useRepo();
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => parseCompare(params.get('roles'), new Set(data.roles.map((r) => r.id))), [params, data.roles]);
  const set = (next: string[]) => {
    const p = new URLSearchParams(params);
    if (next.length) p.set('roles', next.join(','));
    else p.delete('roles');
    setParams(p, { replace: true });
  };
  const roles = ids.map((id) => data.roleById.get(id)!);
  const comps = useQuery(['role_competencies', 'competencies'], async () => {
    const [rc, cs] = await Promise.all([repo.list('role_competencies', { filter: { role_id: ids.length ? ids : ['-'] } }), repo.list('competencies')]);
    return { rc, cs };
  }, [ids.join(',')]);

  const add = (
    <div className="max-w-sm">
      <SelectField
        label={t('m01.compare.addRole')}
        name="add"
        value=""
        onChange={(v) => v && set([...ids, v].slice(0, 3))}
        options={data.roles.filter((r) => !ids.includes(r.id)).map((r) => ({ value: r.id, label: pick(r, 'title') }))}
        placeholder={t('common.choose')}
        disabled={ids.length >= 3}
        hint={t('m01.compare.max')}
      />
    </div>
  );
  if (roles.length < 2)
    return (
      <>
        {add}
        <EmptyState title={t('m01.compare.needTwo')} action={<L to="/careers" className="btn-outline btn-sm">{t('m01.role.backToMap')}</L>}>
          {roles.length === 1 && t('m01.compare.oneChosen', { role: pick(roles[0], 'title') })}
        </EmptyState>
      </>
    );

  const row = (label: string, cell: (i: number) => ReactNode) => (
    <tr>
      <th scope="row" className="w-48 text-start align-top">
        {label}
      </th>
      {roles.map((_, i) => (
        <td key={i} className="align-top text-[13.5px]">
          {cell(i)}
        </td>
      ))}
    </tr>
  );
  const routesOf = (i: number) => (Array.isArray(roles[i].entry_routes) ? (roles[i].entry_routes as { id: string; en: string; ar: string; rule_ref?: string }[]) : []).filter((r) => r.id !== 'clearance');

  return (
    <>
      {ids.length < 3 && add}
      <div className="card overflow-x-auto p-0">
        <table className="table-base w-full min-w-[760px]" data-testid="m01-compare-table">
          <thead>
            <tr>
              <th />
              {roles.map((r) => (
                <th key={r.id} className="text-start align-top">
                  <div className="flex items-start justify-between gap-2">
                    <L to={`/careers/roles/${r.id}`} className="font-semibold">
                      {pick(r, 'title')}
                    </L>
                    <button className="btn-ghost btn-sm" onClick={() => set(ids.filter((x) => x !== r.id))} aria-label={t('m01.compare.remove', { role: pick(r, 'title') })}>
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                  <div className="mt-1">
                    <RoleBadges role={r} compact />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row(t('m01.f.family'), (i) => pick(data.familyById.get(roles[i].family_id), 'name'))}
            {row(t('m01.f.level'), (i) => t(`m01.level.${roles[i].level}`))}
            {row(t('m01.f.education'), (i) => t(`m01.education.${roles[i].education}`))}
            {row(t('m01.role.what'), (i) => pick(roles[i], 'summary'))}
            {row(t('m01.role.qualifications'), (i) => pick(roles[i], 'qualifications'))}
            {row(t('m01.role.trainingPath'), (i) => pick(roles[i], 'training_path'))}
            {row(t('m01.role.licensingBody'), (i) => pick(roles[i], 'licensing_body'))}
            {row(t('m01.role.regulation'), (i) => (roles[i].regulation_ref ? pick(roles[i], 'regulation_ref') : t('m01.role.notRegulated')))}
            {row(t('m01.role.entryRoutes'), (i) =>
              routesOf(i).length ? (
                <ol className="list-decimal space-y-1 ps-4">
                  {routesOf(i).map((r) => (
                    <li key={r.id}>
                      {pick({ x_en: r.en, x_ar: r.ar }, 'x')} {r.rule_ref && <span className="text-ink-3">({refText(r.rule_ref)})</span>}
                    </li>
                  ))}
                </ol>
              ) : (
                '—'
              ),
            )}
            {row(t('m01.role.nextRoles'), (i) => {
              const n = neighbours(data.paths, roles[i].id).next;
              return n.length ? (
                <ul className="space-y-0.5">
                  {n.map((e) => (
                    <li key={e.id}>
                      <L to={`/careers/roles/${e.to_role_id}`}>{pick(data.roleById.get(e.to_role_id), 'title')}</L> <StatusPill tone="neutral">{t(`m01.edgeType.${e.type}`)}</StatusPill>
                    </li>
                  ))}
                </ul>
              ) : (
                '—'
              );
            })}
          </tbody>
        </table>
      </div>
      <Async state={comps}>
        {(c) => {
          const compIds = [...new Set(c.rc.map((r) => r.competency_id))];
          const lvl = (role: string, comp: string) => c.rc.find((r) => r.role_id === role && r.competency_id === comp)?.required_level ?? 0;
          const byId = new Map(c.cs.map((x) => [x.id, x]));
          return (
            <Card title={t('m01.compare.competencies')} padded={false}>
              <div className="overflow-x-auto">
                <table className="table-base w-full min-w-[640px]" data-testid="m01-compare-competencies">
                  <thead>
                    <tr>
                      <th className="text-start">{t('m01.role.competency')}</th>
                      {roles.map((r) => (
                        <th key={r.id} className="text-start">
                          {pick(r, 'title')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compIds.map((cid) => (
                      <tr key={cid}>
                        <td>
                          <span className="num me-1.5 text-ink-3">{byId.get(cid)?.code}</span>
                          {pick(byId.get(cid), 'name')}
                        </td>
                        {roles.map((r) => {
                          const v = lvl(r.id, cid);
                          return (
                            <td key={r.id}>
                              <span className="flex items-center gap-1" role="img" aria-label={t('m01.compare.levelOf', { n: v })}>
                                {[1, 2, 3, 4].map((k) => (
                                  <span key={k} className={`inline-block h-2.5 w-5 rounded-sm ${k <= v ? 'bg-accent' : 'bg-sunken'}`} />
                                ))}
                                <span className="num ms-1 text-[12px] text-ink-3">{v ? f.num(v) : '—'}</span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        }}
      </Async>
    </>
  );
}

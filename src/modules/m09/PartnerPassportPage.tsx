// F33 /partner/workforce/passport: the contractor skills passport. A contractor (partner_user) sees their own passport; a partner admin
// sees the team matrix against the ENEC role profiles their organisation is contracted for, the people list and their own passport.
// RLS scopes everything to the organisation (no cross-org reads). Kafa'a prepares; ENEC evaluators decide equivalency.
import { useMemo, useState } from 'react';
import { Page, Card, Async, EmptyState, Tabs, Grid, StatTile, WhyThis, DataTable, Icon, downloadText, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, useFormat, L, useNav } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { BasisChip } from '../m17/ui';
import { teamMatrix, type TeamMatrix } from './teamMatrix';
import { ContractorPassportView, NotAuthority, useCpData, type Row } from './passportUi';
import { MStatus, useMyOrg } from './shared';

export default function PartnerPassportPage() {
  const t = useT();
  const { isAdmin, personId } = useMyOrg();
  return (
    <Page title={t('m09.routes.partner-passport.title')} intro={t(isAdmin ? 'm09.cp.introAdmin' : 'm09.cp.introSelf')}
      actions={<L to="/partner/workforce/precheck" className="btn-outline" data-testid="m09-cp-precheck-link">{t('m09.cp.toPrecheck')}</L>}>
      <NotAuthority />
      {isAdmin ? <AdminView /> : <OwnPassport personId={personId} />}
    </Page>
  );
}

function OwnPassport({ personId }: { personId: string | null }) {
  const t = useT();
  const q = useCpData(personId);
  return (
    <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m09.cp.noPassport')}>{t('m09.cp.noPassportBody')}</EmptyState>}>
      {(d) => <ContractorPassportView d={d!} mode="self" precheckHref="/partner/workforce/precheck" />}
    </Async>
  );
}

function AdminView() {
  const t = useT();
  const repo = useRepo();
  const { orgId, personId } = useMyOrg();
  const q = useQuery(['people', 'person_skills', 'contract_role_targets', 'equivalency_requests', 'certificates', 'contractor_engagements'], async () => {
    const L_ = (tbl: string, o: object = {}) => (repo.list(tbl as never, o as never) as Promise<Row[]>).catch(() => [] as Row[]);
    const [people, states, skills, comps, roleComps, roles, targets, requests, standards, certs, engagements] = await Promise.all([
      L_('people', { filter: { org_id: orgId ?? '' }, order: [['display_name', 'asc']] }),
      L_('person_skills', { filter: { org_id: orgId ?? '', active: true } }),
      L_('skills', { order: [['sort', 'asc']] }),
      L_('competencies'),
      L_('role_competencies'),
      L_('job_roles', { filter: { status: 'published' } }),
      L_('contract_role_targets', { filter: { org_id: orgId ?? '', active: true } }),
      L_('equivalency_requests', { filter: { org_id: orgId ?? '' } }),
      L_('qual_standards', { order: [['code', 'asc']] }),
      L_('certificates', { filter: { org_id: orgId ?? '' } }),
      L_('contractor_engagements', { filter: { org_id: orgId ?? '' } }),
    ]);
    return { people, states, skills, comps, roleComps, roles, targets, requests, standards, certs, engagements };
  }, [orgId]);
  return (
    <Async state={q} isEmpty={() => false}>
      {(d) => (
        <Tabs tabs={[
          { id: 'team', label: t('m09.cp.tab.team'), content: <TeamTab d={d} /> },
          { id: 'people', label: t('m09.cp.tab.people'), content: <PeopleTab d={d} /> },
          { id: 'mine', label: t('m09.cp.tab.mine'), content: <OwnPassport personId={personId} /> },
        ]} />
      )}
    </Async>
  );
}

type AdminData = { people: Row[]; states: Row[]; skills: Row[]; comps: Row[]; roleComps: Row[]; roles: Row[]; targets: Row[]; requests: Row[]; standards: Row[]; certs: Row[]; engagements: Row[] };

function TeamTab({ d }: { d: AdminData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const nav = useNav();
  const targets = [...d.targets].sort((a, b) => String(a.role_id).localeCompare(String(b.role_id)));
  const [sel, setSel] = useState<string>(targets[0]?.id ?? '');
  const target = targets.find((x) => x.id === sel) ?? targets[0];
  const contractors = d.people.filter((p) => p.kind === 'contractor');
  const m: TeamMatrix | null = useMemo(() => (target ? teamMatrix({ people: contractors, states: d.states, skills: d.skills, comps: d.comps, roleComps: d.roleComps, roleId: target.role_id, band: target.headcount_band, requests: d.requests, standards: d.standards }) : null), [target, contractors, d]);
  if (!target || !m) return <EmptyState title={t('m09.cp.noTargets')}>{t('m09.cp.noTargetsBody')}</EmptyState>;
  const comp = (id: string) => d.comps.find((c) => c.id === id);
  const std = (id: string) => d.standards.find((s) => s.id === id);
  const assigned = m.rows.filter((r) => r.assigned).length;
  const weakest = [...m.coverage].sort((a, b) => a.met - b.met)[0];
  const csv = () => {
    const head = [t('m09.cp.col.person'), t('m09.cp.col.readiness'), ...m.required.map((r) => comp(r.competency_id)?.code ?? r.competency_id), ...m.standards.map((s) => s.code)];
    const lines = m.rows.map((r) => [pick(r.person, 'display_name'), `${Math.round(r.readiness * 100)}%`, ...r.cells.map((c) => `${c.have}/${c.need}`), ...r.eq.map((e) => e.status ?? '')]);
    downloadText(`kafaa-contractor-matrix-${target.role_id}-${todayIso()}.csv`, [head, ...lines].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };
  const cellCls: Record<string, string> = { met: 'bg-ok-bg text-ok', near: 'bg-sim-bg text-sim', gap: 'bg-bad-bg text-bad' };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={t('m09.cp.targetsLabel')} data-testid="m09-cp-targets">
        {targets.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={x.id === target.id} onClick={() => setSel(x.id)} data-testid="m09-cp-target"
            className={`card p-3 text-start transition ${x.id === target.id ? 'ring-2 ring-accent' : 'hover:border-accent/40'}`}>
            <div className="caps">{t('m09.cp.contracted')}</div>
            <div className="font-semibold">{pick(d.roles.find((r) => r.id === x.role_id), 'title')}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
              <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m09.cp.band', { band: x.headcount_band })}</span>
              {x.contract_ref && <span className="num">{x.contract_ref}</span>}
            </div>
            {pick(x, 'scope') && <div className="mt-1 text-[12px] text-ink-3">{pick(x, 'scope')}</div>}
          </button>
        ))}
      </div>
      <Grid cols={4}>
        <StatTile label={t('m09.cp.stat.contractors')} value={f.num(contractors.length)} sub={t('m09.cp.stat.assigned', { n: f.num(assigned) })} />
        <StatTile label={t('m09.cp.stat.ready')} value={`${f.num(m.ready)} / ${f.num(m.bandMin)}`} sub={t('m09.cp.stat.readySub', { band: target.headcount_band })} tone={m.ready >= m.bandMin ? 'ok' : 'bad'} />
        <StatTile label={t('m09.cp.stat.weakest')} value={weakest ? comp(weakest.competency_id)?.code ?? '—' : '—'} sub={weakest ? t('m09.cp.stat.weakestSub', { n: f.num(weakest.met), total: f.num(m.rows.length), need: f.num(weakest.need) }) : undefined} />
        <StatTile label={t('m09.cp.stat.open')} value={f.num(d.requests.filter((r) => ['submitted', 'under_review'].includes(r.status)).length)} sub={t('m09.cp.stat.openSub')} tone="info" />
      </Grid>
      <Card title={t('m09.cp.matrixTitle', { role: pick(d.roles.find((r) => r.id === target.role_id), 'title') })} actions={<button type="button" className="btn-outline btn-sm" onClick={csv} data-testid="m09-cp-csv"><Icon name="download" size={14} />CSV</button>} padded={false}>
        {m.rows.length === 0 ? <div className="p-4"><EmptyState title={t('m09.cp.noContractors')} /></div> : (
          <div className="overflow-x-auto">
            <table className="table-base w-full text-[12.5px]" data-testid="m09-cp-matrix">
              <caption className="sr-only">{t('m09.cp.matrixCaption')}</caption>
              <thead className="bg-raised">
                <tr>
                  <th scope="col" className="text-start">{t('m09.cp.col.person')}</th>
                  <th scope="col">{t('m09.cp.col.readiness')}</th>
                  {m.required.map((r) => <th key={r.competency_id} scope="col" className="text-center" title={pick(comp(r.competency_id), 'name')}><span className="block">{comp(r.competency_id)?.code}</span><span className="block text-[10.5px] font-normal text-ink-3">{t('m09.cp.needN', { n: f.num(r.need) })}</span></th>)}
                  {m.standards.map((s) => <th key={s.id} scope="col" className="text-center">{s.code}</th>)}
                  <th scope="col"><span className="sr-only">{t('common.engines.whyThis')}</span></th>
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.person.id} data-testid="m09-cp-row" data-person={r.person.id}>
                    <th scope="row" className="whitespace-nowrap text-start font-medium">
                      <button type="button" className="link-plain text-start text-accent" onClick={() => nav(`/partner/workforce/passport/${r.person.id}`)}>{pick(r.person, 'display_name')}</button>
                      <span className="block text-[11px] font-normal text-ink-3">{r.assigned ? t('m09.cp.assignedHere') : r.person.job_role_id ? pick(d.roles.find((x) => x.id === r.person.job_role_id), 'title') : t('m09.cp.unassigned')}</span>
                    </th>
                    <td className="num text-center">{f.num(Math.round(r.readiness * 100))}%</td>
                    {r.cells.map((c) => (
                      <td key={c.competency_id} className={`num rounded text-center font-semibold ${cellCls[c.status]}`} data-status={c.status} title={t(`common.skills.basis.${c.basis === 'none' ? 'none' : c.basis}`)}>
                        {f.num(c.have)}<span className="sr-only"> / {f.num(c.need)} {t(`m09.cp.cell.${c.status}`)}</span>
                      </td>
                    ))}
                    {r.eq.map((e) => <td key={e.standard_id} className="text-center">{e.status ? <MStatus status={e.status} /> : <span className="text-ink-3">—</span>}</td>)}
                    <td><WhyThis reasons={r.reasons} testId="m09-cp-row-why" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-raised">
                  <th scope="row" className="text-start text-[12px] font-semibold">{t('m09.cp.coverageRow')}</th>
                  <td />
                  {m.coverage.map((c) => <td key={c.competency_id} className="num text-center text-[12px]" data-testid="m09-cp-coverage">{f.num(c.met)}/{f.num(m.rows.length)}</td>)}
                  {m.standards.map((s) => <td key={s.id} />)}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-[12px] text-ink-2">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded-sm bg-ok-bg ring-1 ring-ok-line" />{t('m09.cp.cell.met')}</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded-sm bg-sim-bg ring-1 ring-sim-line" />{t('m09.cp.cell.near')}</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded-sm bg-bad-bg ring-1 ring-bad-line" />{t('m09.cp.cell.gap')}</span>
          <span className="text-ink-3">{t('m09.cp.matrixNote', { standards: m.standards.map((s) => std(s.id)?.code).join(', ') || '—' })}</span>
        </div>
      </Card>
    </div>
  );
}

function PeopleTab({ d }: { d: AdminData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const nav = useNav();
  const today = todayIso();
  type P = { p: Row; skills: number; backed: number; certs: number; eng: number; last: Row | null; top: string };
  const rows: P[] = d.people.map((p) => {
    const st = d.states.filter((s) => s.person_id === p.id && Number(s.level) > 0);
    const reqs = d.requests.filter((r) => r.person_id === p.id).sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
    const best = ['verified', 'evidenced', 'validated', 'claimed'].find((b) => st.some((s) => s.basis === b)) ?? 'none';
    return { p, skills: st.length, backed: st.filter((s) => s.basis !== 'claimed').length, certs: d.certs.filter((c) => c.person_id === p.id && c.status === 'valid' && (!c.valid_to || String(c.valid_to).slice(0, 10) >= today)).length, eng: d.engagements.filter((g) => g.person_id === p.id && g.status === 'signed_off').length, last: reqs[0] ?? null, top: best };
  });
  const cols: Column<P>[] = [
    { key: 'name', header: t('m09.cp.col.person'), value: (r) => pick(r.p, 'display_name'), sortable: true, render: (r) => <span className="font-medium text-accent">{pick(r.p, 'display_name')}</span> },
    { key: 'role', header: t('m09.cp.col.role'), value: (r) => (r.p.job_role_id ? pick(d.roles.find((x) => x.id === r.p.job_role_id), 'title') : r.p.kind === 'partner' ? t('m09.cp.partnerStaff') : '—'), sortable: true },
    { key: 'skills', header: t('m09.cp.col.skills'), value: (r) => r.skills, sortable: true, align: 'end', render: (r) => f.num(r.skills) },
    { key: 'backed', header: t('m09.cp.col.backed'), value: (r) => r.backed, sortable: true, align: 'end', render: (r) => <span className="inline-flex items-center gap-1.5">{f.num(r.backed)} {r.top !== 'none' && <BasisChip basis={r.top} />}</span> },
    { key: 'certs', header: t('m09.cp.col.certs'), value: (r) => r.certs, sortable: true, align: 'end', render: (r) => f.num(r.certs) },
    { key: 'eng', header: t('m09.cp.col.eng'), value: (r) => r.eng, sortable: true, align: 'end', render: (r) => f.num(r.eng) },
    { key: 'eq', header: t('m09.cp.col.eq'), value: (r) => r.last?.status ?? '', render: (r) => (r.last ? <MStatus status={r.last.status} /> : <span className="text-ink-3">—</span>) },
  ];
  return <DataTable rows={rows} columns={cols} rowKey={(r) => r.p.id} csvName="kafaa-contractor-passports" onRowClick={(r) => nav(`/partner/workforce/passport/${r.p.id}`)} caption={t('m09.cp.tab.people')} initialSort={{ key: 'backed', dir: 'desc' }} />;
}

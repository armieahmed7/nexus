// FS38 /my/next-gen (skills_profile Own): the SMR delta overlay for my role. For each ADVANCE technology family ranked for my current
// role: what changes along the seven dimensions and what stays, the change size, the skills the delta asks for (the delta's own plus the
// smr_design skills of the role's published FS05 2035 profile, the higher level wins) against my F01 levels, my readiness, the training
// that closes my gaps, related concept roles (never shown as my role) and the sources. Security, safeguards and cyber roles stay at
// career-path level. Computed in the browser from public rows and my own skill states (deltaFor). Planning assumption: no deployment
// decision implied.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, ProgressRing, ProgressBar, StatusPill, WhyThis, EngineBadge, BenchmarkChips, SelectField, Tabs, SimChip } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { L, techDesigns, useFormat, usePick, useT } from '../../i18n';
import { deltaFor, PATH_ONLY_FAMILIES, type DeltaRow, type ProfileReq } from './nextgen';
import { DeltaBody, NoDeployNote, TechName, TrainingLink, trainingSkills, useNgRef, type RefData, type Row } from './ui';

function useMine(personId: string | null, roleOverride: string | null) {
  const repo = useRepo();
  return useQuery(['people', 'person_skills', 'smr_deltas', 'role_profile_versions'], async () => {
    const me = personId ? ((await repo.get('people', personId).catch(() => null)) as Row | null) : null;
    const roleId = roleOverride || (me?.job_role_id as string | null) || null;
    const [states, deltas, versions] = await Promise.all([
      personId ? (repo.list('person_skills', { filter: { person_id: personId } } as never) as Promise<Row[]>).catch(() => [] as Row[]) : Promise.resolve([] as Row[]),
      roleId ? (repo.list('smr_deltas', { filter: { role_id: roleId } } as never) as Promise<Row[]>).catch(() => [] as Row[]) : Promise.resolve([] as Row[]),
      roleId ? (repo.list('role_profile_versions', { filter: { role_id: roleId } } as never) as Promise<Row[]>).catch(() => [] as Row[]) : Promise.resolve([] as Row[]),
    ]);
    const prof = versions.filter((v) => v.horizon === '2035' && v.status === 'published').sort((a, b) => Number(b.version) - Number(a.version))[0];
    return { me, myRole: (me?.job_role_id as string | null) ?? null, roleId, states: states.filter((s) => s.active), deltas: deltas.filter((x) => x.status === 'published').sort((a, b) => Number(a.rank) - Number(b.rank)), profile: (prof?.requirements ?? null) as ProfileReq[] | null };
  }, [personId, roleOverride]);
}

export default function MyNextGenPage() {
  const t = useT();
  const pick = usePick();
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const role = sp.get('role');
  const ref = useNgRef();
  const q = useMine(s.identity.personId, role);
  const eng = useEngine('transform');
  return (
    <Page title={t('m31.routes.my-next-gen.title')} intro={t('m31.my.intro')} wide
      eyebrow={<span className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><SimChip label={t('m31.ng.planningChip')} /><BenchmarkChips feature="FS38" /><EngineBadge engine={eng} /></span>}
      actions={<L to="/careers/next-gen" className="btn-outline btn-sm no-underline" data-testid="m31-to-public">{t('m31.my.toPublic')}</L>}>
      <Async state={ref}>{(d) => (
        <Async state={q}>{(m) => (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-3" data-testid="m31-my-controls">
              <div className="min-w-0 flex-1 sm:max-w-md">
                <SelectField label={t('m31.my.roleLabel')} name="role" value={m.roleId ?? ''} placeholder={t('m31.my.rolePlaceholder')}
                  options={d.roles.map((r) => ({ value: r.id, label: `${pick(r, 'title')}${r.id === m.myRole ? ` (${t('m31.my.mineTag')})` : ''}` }))}
                  onChange={(v) => { const n = new URLSearchParams(sp); if (v && v !== m.myRole) n.set('role', v); else n.delete('role'); setSp(n, { replace: true }); }} />
              </div>
              {role && m.myRole && role !== m.myRole && <button type="button" className="btn-ghost btn-sm" onClick={() => { const n = new URLSearchParams(sp); n.delete('role'); setSp(n, { replace: true }); }}>{t('m31.my.backToMine')}</button>}
            </div>
            {!m.roleId ? <EmptyState title={t('m31.my.noRole')}>{t('m31.my.noRoleBody')}</EmptyState>
              : <RoleView d={d} roleId={m.roleId} mine={m.roleId === m.myRole} deltas={m.deltas} states={m.states} profile={m.profile} />}
            <NoDeployNote />
          </div>
        )}</Async>
      )}</Async>
    </Page>
  );
}

function RoleView({ d, roleId, mine, deltas, states, profile }: { d: RefData; roleId: string; mine: boolean; deltas: Row[]; states: Row[]; profile: ProfileReq[] | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const role = d.roleById.get(roleId);
  const ts = useMemo(() => trainingSkills(d), [d]);
  const views = useMemo(() => deltas.map((x) => ({ row: x, v: deltaFor(x as unknown as DeltaRow, profile, states as never, ts) })), [deltas, profile, states, ts]);
  const [tab, setTab] = useState<string | undefined>(undefined);
  if (!role) return <EmptyState title={t('m31.my.notCurrent')} />;
  const pathOnly = PATH_ONLY_FAMILIES.includes(role.family_id);
  const best = views.filter((x) => x.v.readiness != null).sort((a, b) => Number(b.v.readiness) - Number(a.v.readiness))[0];
  return (
    <div className="space-y-6" data-testid="m31-my" data-role={roleId} data-mine={mine ? 'yes' : 'no'}>
      <Card className="border-accent/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="caps" data-testid="m31-my-label">{mine ? t('m31.my.myRole') : t('m31.my.exploring')}</span>
            <h2 className="text-[20px] font-semibold leading-tight">{pick(role, 'title')}</h2>
            <p className="text-[13px] text-ink-2">{d.families.get(role.family_id) ? pick(d.families.get(role.family_id), 'name') : role.family_id}</p>
          </div>
          <L to={`/careers/roles/${roleId}`} className="btn-outline btn-sm no-underline">{t('m31.my.toRole')}</L>
        </div>
      </Card>
      {pathOnly && <Callout tone="info" title={t('m31.ng.pathOnly.title')}><span data-testid="m31-path-only">{t('m31.ng.pathOnly.body')}</span></Callout>}
      {views.length === 0 ? <EmptyState title={t('m31.my.noDeltas')} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m31-my-tiles">
            <StatTile label={t('m31.my.tile.techs')} value={f.num(views.length)} sub={t('m31.my.tile.techsSub')} />
            <StatTile label={t('m31.my.tile.largest')} value={t(`m31.ng.band.${[...views].sort((a, b) => b.v.change_size - a.v.change_size)[0].v.band}`)} sub={<TechName d={d} id={[...views].sort((a, b) => b.v.change_size - a.v.change_size)[0].v.tech_id} />} tone="info" />
            <StatTile label={t('m31.my.tile.best')} value={best ? f.pct(best.v.readiness, 0) : '—'} sub={best ? <TechName d={d} id={best.v.tech_id} /> : t('m31.ng.pathOnlyShort')} tone="ok" />
            <StatTile label={t('m31.my.tile.gaps')} value={f.num(new Set(views.flatMap((x) => x.v.needs.filter((n) => n.gap > 0).map((n) => n.skill_id))).size)} sub={t('m31.my.tile.gapsSub')} />
          </div>
          <Tabs value={tab ?? views[0].row.tech_id} onChange={setTab}
            tabs={views.map(({ row, v }) => ({
              id: row.tech_id,
              label: <span className="inline-flex items-center gap-1.5" data-testid="m31-tech-tab" data-tech={row.tech_id}><TechName d={d} id={row.tech_id} /><span className="num text-ink-3">#{f.num(row.rank)}</span></span>,
              content: <DeltaPanel d={d} row={row} v={v} />,
            }))} />
        </>
      )}
    </div>
  );
}

function DeltaPanel({ d, row, v }: { d: RefData; row: Row; v: ReturnType<typeof deltaFor> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const tech = d.techById.get(row.tech_id);
  return (
    <div className="space-y-4 pt-2" data-testid="m31-panel" data-tech={row.tech_id} data-readiness={v.readiness ?? ''} data-band={v.band}>
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          {v.readiness != null ? <ProgressRing value={v.readiness} size={84} label={f.pct(v.readiness, 0)} tone={v.readiness >= 50 ? 'ok' : 'accent'} /> : <StatusPill tone="info">{t('m31.ng.pathOnlyShort')}</StatusPill>}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[17px] font-semibold">{tech ? pick(tech, 'family') : row.tech_id}</p>
            <p className="text-[13px] text-ink-2">{techDesigns(t, tech?.designs)} · {tech ? pick(tech, 'skill_areas') : ''}</p>
            <p className="text-[13px]" data-testid="m31-size">{t('m31.ng.sizeLine', { n: f.num(v.change_size), band: t(`m31.ng.band.${v.band}`) })}{v.readiness != null && <> · {t('m31.ng.readyLine', { met: f.num(v.met), total: f.num(v.total) })}</>}</p>
            <WhyThis reasons={v.reasons} testId="m31-why" />
          </div>
        </div>
      </Card>
      {!v.path_only && v.needs.length > 0 && (
        <Section title={t('m31.my.needsTitle')} description={t('m31.my.needsDesc')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]" data-testid="m31-needs">
              <thead><tr className="text-start text-ink-3"><th className="py-1 text-start font-semibold">{t('m31.my.col.skill')}</th><th className="py-1 text-start font-semibold">{t('m31.my.col.source')}</th><th className="py-1 text-start font-semibold">{t('m31.my.col.level')}</th><th className="w-40 py-1 text-start font-semibold">{t('m31.my.col.progress')}</th></tr></thead>
              <tbody className="divide-y divide-line">
                {v.needs.map((n) => (
                  <tr key={n.skill_id} data-skill={n.skill_id} data-gap={n.gap}>
                    <td className="py-1.5 pe-2"><L to={`/skills/${n.skill_id}`}>{d.skills.get(n.skill_id) ? pick(d.skills.get(n.skill_id), 'name') : n.skill_id}</L></td>
                    <td className="py-1.5 pe-2 text-ink-2">{t(`m31.ng.source.${n.source}`)}</td>
                    <td className="num py-1.5 pe-2">{t('m31.my.haveNeed', { have: f.num(n.have), need: f.num(n.need) })}</td>
                    <td className="py-1.5"><ProgressBar value={Math.min(100, (100 * n.have) / n.need)} tone={n.gap === 0 ? 'ok' : 'accent'} label={t('m31.my.haveNeed', { have: f.num(n.have), need: f.num(n.need) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {!v.path_only && v.training.length > 0 && (
        <Card title={t('m31.my.closeTitle')} eyebrow={t('m31.my.closeEyebrow')}>
          <ul className="space-y-1.5" data-testid="m31-close">{[...v.training].sort((a, b) => b.closes.length - a.closes.length).map((x) => <TrainingLink key={`${x.kind}:${x.ref}`} d={d} kind={x.kind} refId={x.ref} closes={x.closes} />)}</ul>
        </Card>
      )}
      <DeltaBody d={d} delta={row} />
    </div>
  );
}

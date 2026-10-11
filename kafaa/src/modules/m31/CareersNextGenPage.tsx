// FS38 /careers/next-gen (public summary): the SMR delta overlay for every current Barakah role. A role x technology grid (the change
// size of each published delta, no personal data and no numbers about people), then for the chosen role and technology what changes
// along the seven dimensions, what stays, the skills (names) and training the delta asks for, related concept roles and the sources.
// Security, safeguards and cyber roles show the career path only. Planning assumption: no deployment decision implied.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, BenchmarkChips, SelectField, SimChip } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { changeSize, sizeBand, PATH_ONLY_FAMILIES, type DeltaDim } from './nextgen';
import { DeltaBody, NoDeployNote, TechName, useNgRef, type RefData, type Row } from './ui';

export default function CareersNextGenPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useNgRef();
  const q = useQuery(['smr_deltas'], () => (repo.list('smr_deltas', { order: [['sort', 'asc']] } as never) as Promise<Row[]>).then((xs) => xs.filter((x) => x.status === 'published')), []);
  return (
    <Page title={t('m31.routes.careers-next-gen.title')} intro={t('m31.pub.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><SimChip label={t('m31.ng.planningChip')} /><BenchmarkChips feature="FS38" /></span>}
      actions={<L to="/my/next-gen" className="btn-primary btn-sm no-underline" data-testid="m31-pub-mine">{t('m31.pub.mine')}</L>}>
      <Async state={ref}>{(d) => <Async state={q} isEmpty={(xs) => xs.length === 0} empty={<EmptyState title={t('m31.pub.none')} />}>{(deltas) => <Body d={d} deltas={deltas} />}</Async>}</Async>
    </Page>
  );
}

function Body({ d, deltas }: { d: RefData; deltas: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [sp, setSp] = useSearchParams();
  const byKey = useMemo(() => new Map(deltas.map((x) => [`${x.role_id}|${x.tech_id}`, x])), [deltas]);
  const roleId = sp.get('role') && d.roleById.has(sp.get('role')!) ? sp.get('role')! : d.roles[0]?.id;
  const mine = deltas.filter((x) => x.role_id === roleId).sort((a, b) => Number(a.rank) - Number(b.rank));
  const techId = sp.get('tech') && byKey.has(`${roleId}|${sp.get('tech')}`) ? sp.get('tech')! : mine[0]?.tech_id;
  const cur = techId ? byKey.get(`${roleId}|${techId}`) : undefined;
  const set = (role: string, tech?: string) => { const n = new URLSearchParams(sp); n.set('role', role); if (tech) n.set('tech', tech); else n.delete('tech'); setSp(n, { replace: true }); };
  const role = roleId ? d.roleById.get(roleId) : undefined;
  return (
    <div className="space-y-6">
      <Callout tone="sim" title={t('m31.pub.planningTitle')}>{t('m31.pub.planningBody')}</Callout>
      <Section title={t('m31.pub.gridTitle')} description={t('m31.pub.gridDesc')}>
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[720px] text-[12.5px]" data-testid="m31-grid">
            <caption className="sr-only">{t('m31.pub.gridTitle')}</caption>
            <thead className="bg-sunken"><tr><th scope="col" className="p-2 text-start font-semibold">{t('m31.pub.role')}</th>{d.techs.map((x) => <th key={x.id} scope="col" className="p-2 text-start font-semibold">{pick(x, 'family')}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {d.roles.map((r) => (
                <tr key={r.id} className={r.id === roleId ? 'bg-accent-soft' : ''}>
                  <th scope="row" className="p-2 text-start font-normal"><button type="button" className="text-start underline-offset-2 hover:underline" onClick={() => set(r.id)} data-testid="m31-grid-role" data-role={r.id}>{pick(r, 'title')}</button></th>
                  {d.techs.map((x) => {
                    const dl = byKey.get(`${r.id}|${x.id}`);
                    if (!dl) return <td key={x.id} className="p-2 text-ink-3">·</td>;
                    const band = dl.path_only ? 'path' : sizeBand(changeSize(dl.dims as DeltaDim[]));
                    const tone = band === 'large' ? 'bg-[rgb(var(--accent))] text-white border-transparent' : band === 'moderate' ? 'border-accent/40 bg-accent-soft text-eyebrow' : band === 'path' ? 'border-line bg-sunken text-ink-3' : 'border-line bg-panel text-ink-2';
                    return (
                      <td key={x.id} className="p-1.5">
                        <button type="button" className={`chip normal-case tracking-normal ${tone} ${r.id === roleId && x.id === techId ? 'ring-2 ring-[rgb(var(--accent))]' : ''}`} onClick={() => set(r.id, x.id)} data-testid="m31-grid-cell" data-role={r.id} data-tech={x.id} data-band={band}
                          aria-label={`${pick(r, 'title')} · ${pick(x, 'family')}: ${t(`m31.ng.band.${band}`)}`}>
                          <span className="num">#{f.num(dl.rank)}</span> {t(`m31.ng.band.${band}`)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-ink-3">{t('m31.pub.gridLegend')}</p>
      </Section>
      {role && (
        <Section title={t('m31.pub.deltaTitle', { role: pick(role, 'title') })} description={t('m31.pub.deltaDesc')}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 sm:max-w-sm"><SelectField label={t('m31.pub.role')} name="role" value={roleId ?? ''} options={d.roles.map((r) => ({ value: r.id, label: pick(r, 'title') }))} onChange={(v) => v && set(v)} /></div>
            <div className="min-w-0 flex-1 sm:max-w-sm"><SelectField label={t('m31.pub.tech')} name="tech" value={techId ?? ''} options={mine.map((x) => ({ value: x.tech_id, label: `#${x.rank} ${pick(d.techById.get(x.tech_id), 'family')}` }))} onChange={(v) => v && set(roleId!, v)} /></div>
            <L to={`/careers/roles/${roleId}`} className="btn-outline btn-sm no-underline">{t('m31.pub.toRole')}</L>
          </div>
          {PATH_ONLY_FAMILIES.includes(role.family_id) && <Callout tone="info" title={t('m31.ng.pathOnly.title')}><span data-testid="m31-path-only">{t('m31.ng.pathOnly.body')}</span></Callout>}
          {cur ? (
            <DeltaBody d={d} delta={cur} aside={<Card><p className="text-[13px]">{t('m31.pub.techLabel')} <strong><TechName d={d} id={cur.tech_id} /></strong> · {d.techById.get(cur.tech_id)?.designs} · {t('m31.ng.sizeLine', { n: f.num(changeSize(cur.dims)), band: t(`m31.ng.band.${cur.path_only ? 'path' : sizeBand(changeSize(cur.dims))}`) })} · {t('m31.pub.version', { v: f.num(cur.version), date: f.date(cur.as_of) })}</p></Card>} />
          ) : <EmptyState title={t('m31.pub.noDelta')} />}
        </Section>
      )}
      <NoDeployNote />
    </div>
  );
}

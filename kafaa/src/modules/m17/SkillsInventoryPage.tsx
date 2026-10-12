// FS84 /workforce/skills-inventory (skills_profile Agg: HR analyst, HR director; A: the training manager): the organisation skills
// inventory and its data-quality panel. Every non-security skill by area and by entity (or job family): people holding it at its key
// level with counted evidence (verified, evidenced or validated; a self-claim never counts); every cell under 10 is suppressed and
// security, safeguards and cyber families are never broken out. The data-quality panel shows profile coverage, staleness (FS03 decay:
// the newest evidence past its half-life; FS54: the skill definition past its review date) and the share validated, overall and per
// group, each with its definition, so the figures reproduce from the published rules (TS = SQL). No names, no person ids.
import { useState } from 'react';
import { Page, Section, Async, BarChart, BenchmarkChips, Callout, EmptyState, Heatmap, Icon, StatTile, downloadText } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { INV_DIMS, TT_MIN, type InvDim, type OrgInventory } from './teamTargets';
import type { SkillInventory } from './backend/rpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function SkillsInventoryPage() {
  const t = useT();
  const repo = useRepo();
  const [dim, setDim] = useState<InvDim>('entity');
  const q = useQuery(['person_skills', 'skills', 'people', 'role_profile_versions'], () => repo.rpc.orgSkillInventory(dim), [dim]);
  const lk = useQuery(['skills', 'job_families', 'organisations'], async () => {
    const [skills, fams, orgs] = await Promise.all([
      repo.list('skills', { order: [['sort', 'asc']] }) as Promise<Row[]>,
      repo.list('job_families') as Promise<Row[]>,
      repo.list('organisations').catch(() => []) as Promise<Row[]>,
    ]);
    return { skill: new Map(skills.map((s) => [s.id, s])), fam: new Map(fams.map((x) => [x.id, x])), org: new Map(orgs.map((x) => [x.id, x])) };
  }, []);
  return (
    <Page wide title={t('m17.routes.workforce-skills-inventory.title')} intro={t('m17.inv.intro')} eyebrow={<BenchmarkChips feature="FS84" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/team/skills/future" className="btn-outline btn-sm no-underline" data-testid="m17-inv-to-targets">{t('m17.inv.toTargets')}</L>
        <L to="/admin/skills-confidence" className="btn-ghost btn-sm no-underline">{t('m17.inv.toConfidence')}</L>
      </div>}>
      <Async state={{ data: q.data !== undefined && lk.data ? { d: q.data, lk: lk.data } : undefined, loading: q.loading || lk.loading, error: q.error ?? lk.error, reload: q.reload }}
        isEmpty={(x) => !x.d} empty={<EmptyState title={t('m17.inv.forbiddenTitle')}>{t('m17.inv.forbidden')}</EmptyState>}>
        {({ d, lk: l }) => (d ? <Inventory d={d} lk={l} dim={dim} onDim={setDim} /> : null)}
      </Async>
    </Page>
  );
}

type Lookups = { skill: Map<string, Row>; fam: Map<string, Row>; org: Map<string, Row> };

function Sup() {
  const t = useT();
  return <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{t('common.suppressedShort')}</span>;
}

function Inventory({ d, lk, dim, onDim }: { d: SkillInventory; lk: Lookups; dim: InvDim; onDim: (x: InvDim) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const inv = d.inventory;
  const qy = d.quality;
  const gLabel = (id: string) => (dim === 'entity' ? (lk.org.get(id) ? pick(lk.org.get(id), 'name') : id) : (lk.fam.get(id) ? pick(lk.fam.get(id), 'name') : id));
  const cols = [...inv.groups.map((g) => g.id), '_total'];
  const exportCsv = () => {
    const wm = t('m17.inv.watermark', { role: s.roles.filter((r) => r !== 'public').join(', '), date: f.date(todayIso()) });
    const cell = (n: number | null) => (n == null ? '<10' : String(n));
    const lines = [wm, ['skill', 'area', ...inv.groups.map((g) => g.id), 'total'].join(','),
      ...inv.skills.map((r) => [lk.skill.get(r.skill_id)?.code ?? r.skill_id, r.area, ...r.cells.map((c) => cell(c.n)), cell(r.total.n)].join(','))];
    downloadText(`kafaa-skills-inventory-${dim}-${todayIso()}.csv`, lines.join('\n'));
  };
  return (
    <div className="space-y-6" data-testid="m17-inv" data-dim={inv.dim}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-card border border-line bg-sunken p-1" role="group" aria-label={t('m17.inv.dim')} data-testid="m17-inv-dim">
          {INV_DIMS.map((x) => (
            <button key={x} type="button" aria-pressed={dim === x} onClick={() => onDim(x)} data-testid={`m17-inv-dim-${x}`}
              className={`rounded px-3 py-1.5 text-[13px] font-semibold ${dim === x ? 'bg-panel text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>{t(`m17.inv.dims.${x}`)}</button>
          ))}
        </div>
        <button type="button" className="btn-outline btn-sm" onClick={exportCsv} data-testid="m17-inv-csv"><Icon name="download" size={14} /> {t('m17.inv.csv')}</button>
      </div>

      <Section title={t('m17.inv.qualityTitle')} description={t('m17.inv.qualityIntro', { date: f.date(qy.as_of) })}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m17-inv-quality">
          <StatTile label={t('m17.inv.q.coverage')} value={qy.profiled_pct == null ? <Sup /> : f.pct(qy.profiled_pct, 0)} sub={t('m17.inv.q.coverageSub', { n: qy.profiled == null ? t('common.suppressedShort') : f.num(qy.profiled), of: f.num(qy.staff) })} tone="info" />
          <StatTile label={t('m17.inv.q.req')} value={qy.req_pct == null ? <Sup /> : f.pct(qy.req_pct, 0)} sub={t('m17.inv.q.reqSub', { n: qy.req_recorded == null ? t('common.suppressedShort') : f.num(qy.req_recorded), of: qy.req_total == null ? t('common.suppressedShort') : f.num(qy.req_total) })} />
          <StatTile label={t('m17.inv.q.stale')} value={qy.stale_pct == null ? <Sup /> : f.pct(qy.stale_pct, 0)} sub={t('m17.inv.q.staleSub', { a: qy.ageing == null ? t('common.suppressedShort') : f.num(qy.ageing), r: qy.review_overdue == null ? t('common.suppressedShort') : f.num(qy.review_overdue), k: f.num(qy.overdue_skills) })} tone={qy.stale_pct ? 'sim' : 'ok'} />
          <StatTile label={t('m17.inv.q.validated')} value={qy.validated_pct == null ? <Sup /> : f.pct(qy.validated_pct, 0)} sub={t('m17.inv.q.validatedSub', { n: qy.validated == null ? t('common.suppressedShort') : f.num(qy.validated), of: qy.states == null ? t('common.suppressedShort') : f.num(qy.states) })} tone="ok" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div data-testid="m17-inv-basis">
            <BarChart title={t('m17.inv.basisTitle')} data={(['verified', 'validated', 'evidenced', 'claimed'] as const).map((b) => ({ label: t(`common.skills.basis.${b}`), value: qy.basis[b], suppressed: qy.basis[b] == null }))} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" data-testid="m17-inv-quality-groups">
              <caption className="caps pb-1 text-start text-[10.5px] text-ink-3">{t('m17.inv.byGroup', { dim: t(`m17.inv.dims.${dim}`) })}</caption>
              <thead><tr className="border-b border-line text-ink-3">
                <th scope="col" className="py-1 text-start">{t(`m17.inv.dims.${dim}`)}</th><th scope="col" className="py-1 text-end">{t('m17.inv.col.staff')}</th>
                <th scope="col" className="py-1 text-end">{t('m17.inv.col.coverage')}</th><th scope="col" className="py-1 text-end">{t('m17.inv.col.req')}</th>
                <th scope="col" className="py-1 text-end">{t('m17.inv.col.stale')}</th><th scope="col" className="py-1 text-end">{t('m17.inv.col.validated')}</th>
              </tr></thead>
              <tbody>{qy.by_group.map((g) => (
                <tr key={g.g} className="border-b border-line/60">
                  <th scope="row" className="py-1 pe-2 text-start font-normal">{gLabel(g.g)}</th>
                  {[g.staff, g.profiled_pct, g.req_pct, g.stale_pct, g.validated_pct].map((v, i) => <td key={i} className="num py-1 text-end">{v == null ? <Sup /> : i === 0 ? f.num(v) : f.pct(v, 0)}</td>)}
                </tr>))}</tbody>
            </table>
          </div>
        </div>
        <details className="rounded-card border border-line bg-sunken p-3 text-[12.5px] text-ink-2" data-testid="m17-inv-definitions">
          <summary className="cursor-pointer font-semibold text-ink">{t('m17.inv.defsTitle')}</summary>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {(['coverage', 'req', 'stale', 'validated', 'suppress'] as const).map((k) => <li key={k}>{t(`m17.inv.def.${k}`, { min: TT_MIN })}</li>)}
          </ul>
          <p className="mt-2"><L to="/admin/skills-council">{t('m17.inv.toCouncil')}</L></p>
        </details>
      </Section>

      <Section title={t('m17.inv.heatTitle')} description={t('m17.inv.heatIntro', { min: TT_MIN, n: f.num(inv.skills.length) })}>
        {inv.dim === 'family' && <Callout tone="info" title={t('m17.inv.famNoteTitle')}>{t('m17.inv.famNote')}</Callout>}
        <div data-testid="m17-inv-areas">
          <Heatmap title={t('m17.inv.heatTitle')} rows={inv.areas.map((a) => a.area)} cols={cols}
            rowLabel={(a) => `${t(`m17.area.${a}`)} (${f.num(inv.areas.find((x) => x.area === a)!.skills)})`} colLabel={(c) => (c === '_total' ? t('m17.inv.total') : gLabel(c))}
            value={(row, col) => cellOf(inv, 'area', row, col, f)} />
        </div>
        <div className="space-y-2" data-testid="m17-inv-skills">
          {inv.areas.map((a) => {
            const rows = inv.skills.filter((x) => x.area === a.area);
            return (
              <details key={a.area} className="rounded-card border border-line bg-raised p-3" data-area={a.area}>
                <summary className="cursor-pointer text-[13px] font-semibold text-ink">{t(`m17.area.${a.area}`)} · {t('m17.inv.skillsN', { n: f.num(rows.length), shown: f.num(rows.filter((x) => x.total.n != null).length) })}</summary>
                <div className="mt-2">
                  <Heatmap title={t(`m17.area.${a.area}`)} rows={rows.map((x) => x.skill_id)} cols={cols}
                    rowLabel={(id) => (lk.skill.get(id) ? `${lk.skill.get(id).code} ${pick(lk.skill.get(id), 'name')}` : id)} colLabel={(c) => (c === '_total' ? t('m17.inv.total') : gLabel(c))}
                    value={(row, col) => cellOf(inv, 'skill', row, col, f)} />
                </div>
              </details>
            );
          })}
        </div>
        <p className="text-[12px] text-ink-3">{t('m17.inv.heatNote')}</p>
      </Section>
    </div>
  );
}

function cellOf(inv: OrgInventory, kind: 'area' | 'skill', row: string, col: string, f: { num: (n: number) => string; pct: (n: number | null, d?: number) => string }) {
  const r = kind === 'area' ? inv.areas.find((x) => x.area === row) : inv.skills.find((x) => x.skill_id === row);
  const c = !r ? null : col === '_total' ? r.total : r.cells.find((x) => x.g === col) ?? null;
  if (!c || c.n == null) return { v: null, suppressed: true };
  const p = c.pct ?? 0;
  return { v: c.n, tone: p >= 50 ? 'ok' as const : p >= 20 ? 'info' as const : 'neutral' as const, label: `${f.num(c.n)} · ${f.pct(c.pct, 0)}` };
}

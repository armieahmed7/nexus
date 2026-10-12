// FS73 /national/emirati-pipeline (anyRole hr_analyst, hr_director, auditor; never observers, partners or managers): the Emirati pipeline
// by competency for the critical and future roles. Emirati-ready successors by readiness band and ready-by date come from the F19
// succession slates (live); progression into authorised roles and retention at 12, 24 and 36 months come from the SIMULATED,
// de-identified HR mirror. Aggregate only: every count under 10 shows "<10", a share needs its count and base at 10 or above, and
// nationality is used for this report only, never in any score. Nothing is ranked; WhyThis explains how each area reads.
import { useState } from 'react';
import { Page, Section, Async, BarChart, LineChart, BenchmarkChips, Callout, EmptyState, StatTile, StatusPill, WhyThis, Card, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BANDS, RETENTION_MONTHS, SCOPES, areaReasons, type EmiratiPipeline, type EpArea, type Scope } from './pipeline';
import { Simulated, type Row } from './ui';

export default function EmiratiPipelinePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const [scope, setScope] = useState<Scope>('all');
  const fams = useQuery(['job_families'], () => repo.list('job_families') as Promise<Row[]>, []);
  const ep = useQuery(['succession_slates', 'successors', 'people', 'pipeline_mirror', 'role_outlook_labels'], () => repo.rpc.emiratiPipeline(scope), [scope]);
  return (
    <Page title={t('m37.routes.national-emirati-pipeline.title')} intro={t('m37.ep.intro')} wide eyebrow={<BenchmarkChips feature="FS73" />}
      actions={<div className="flex flex-wrap gap-2">
        {s.can('talent_review', ['R', 'A']) && <L to="/talent/succession" className="btn-outline btn-sm no-underline" data-testid="m37-ep-succession">{t('m37.ep.toSuccession')}</L>}
        <L to="/national/alignment" className="btn-ghost btn-sm no-underline">{t('m37.ro.toAlignment')}</L>
      </div>}>
      <div className="space-y-6" data-testid="m37-ep">
        <Callout tone="info" title={t('m37.ep.aggTitle')}><span data-testid="m37-ep-agg">{t('m37.ep.aggBody', { min: 10 })}</span></Callout>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('m37.ep.scopeLabel')} data-testid="m37-ep-scope">
          {SCOPES.map((k) => (
            <button key={k} type="button" className={k === scope ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={k === scope} onClick={() => setScope(k)} data-testid={`m37-ep-scope-${k}`}>
              {t(`m37.ep.scope.${k}`)}
            </button>
          ))}
        </div>
        <Async state={fams}>{(families) => (
          <Async state={ep} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.ep.none')} />}>{(d) => (d ? <Body d={d} families={families} /> : null)}</Async>
        )}</Async>
      </div>
    </Page>
  );
}

function Sup() {
  const t = useT();
  return <span className="text-ink-3" title={t('common.suppressed')} data-suppressed="true">{t('common.suppressedShort')}</span>;
}
function N({ v, pct = false, testId }: { v: number | null; pct?: boolean; testId?: string }) {
  const f = useFormat();
  return <span className="num" data-testid={testId} data-value={v ?? ''}>{v == null ? <Sup /> : pct ? f.pct(v) : f.num(v)}</span>;
}

function Body({ d, families }: { d: EmiratiPipeline; families: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const fam = (id: string | null) => { if (!id) return t('m37.ep.total'); const x = families.find((y) => y.id === id); return x ? pick(x, 'name') : id; };
  const tot = d.total;
  const next = tot.ready_by[1] ?? tot.ready_by[0];
  const r36 = tot.retention.find((x) => x.months === 36)!;
  const yr = (y: number) => f.num(y, { useGrouping: false });
  return (
    <div className="space-y-6" data-testid="m37-ep-body" data-scope={d.scope}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m37-ep-tiles">
        <StatTile label={t('m37.ep.tile.successors')} value={<N v={tot.successors.emirati} testId="m37-ep-tile-successors" />}
          sub={tot.successors.share_pct == null ? t('m37.ep.tile.successorsSubSup') : t('m37.ep.tile.successorsSub', { pct: f.pct(tot.successors.share_pct) })} tone="info" />
        <StatTile label={t('m37.ep.tile.ready', { date: f.date(next.date) })} value={<N v={next.n} />}
          sub={next.roles == null ? t('m37.ep.tile.readySubSup', { n: f.num(tot.roles) }) : t('m37.ep.tile.readySub', { n: f.num(next.roles), of: f.num(tot.roles) })} tone="ok" />
        <StatTile label={t('m37.ep.tile.authorised')} value={<N v={tot.progression.emirati} />} sim
          sub={tot.progression.share_pct == null ? t('m37.ep.tile.authorisedSubSup') : t('m37.ep.tile.authorisedSub', { pct: f.pct(tot.progression.share_pct) })} />
        <StatTile label={t('m37.ep.tile.retention')} value={<N v={r36.pct} pct />} sim
          sub={r36.all_pct == null ? t('m37.ep.tile.retentionSubSup') : t('m37.ep.tile.retentionSub', { pct: f.pct(r36.all_pct) })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m37.ep.readyTitle')} description={t('m37.ep.readyIntro')}>
          <div className="space-y-3" data-testid="m37-ep-ready">
            <BarChart title={t('m37.ep.readyTitle')} data={tot.ready_by.map((x) => ({ label: f.date(x.date), value: x.n, suppressed: x.n == null }))} />
            <dl className="grid grid-cols-3 gap-2 text-center">
              {BANDS.map((b) => (
                <div key={b} className="rounded-card bg-sunken px-2 py-1.5" data-testid="m37-ep-band" data-band={b}>
                  <dt className="caps text-[10.5px] text-ink-3">{t(`m37.ep.band.${b}`)}</dt>
                  <dd className="text-lg font-semibold"><N v={tot.successors.bands[b]} /></dd>
                </div>
              ))}
            </dl>
            <p className="text-[12.5px] text-ink-3">{t('m37.ep.readyNote')}</p>
          </div>
        </Section>
        <Section title={<span className="inline-flex flex-wrap items-center gap-2">{t('m37.ep.retentionTitle')}<Simulated label={t('m37.ep.mirror')} /></span>} description={t('m37.ep.retentionIntro')}>
          <div className="space-y-3" data-testid="m37-ep-retention" data-simulated="true">
            <LineChart title={t('m37.ep.retentionTitle')} unit="%" yMin={50} yMax={100} series={[
              { name: t('m37.ep.emirati'), points: tot.retention.map((x) => ({ x: t('m37.ep.months', { n: f.num(x.months) }), y: x.pct })) },
              { name: t('m37.ep.allStaff'), points: tot.retention.map((x) => ({ x: t('m37.ep.months', { n: f.num(x.months) }), y: x.all_pct })), dashed: true },
            ]} />
            <p className="text-[12.5px] text-ink-3">{t('m37.ep.retentionNote')}</p>
          </div>
        </Section>
      </div>

      <Section title={t('m37.ep.areasTitle')} description={t('m37.ep.areasIntro')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[12.5px]" data-testid="m37-ep-areas">
            <caption className="sr-only">{t('m37.ep.areasTitle')}</caption>
            <thead>
              <tr className="text-ink-3">
                <th className="text-start">{t('m37.ep.col.area')}</th>
                <th className="text-end">{t('m37.ep.col.roles')}</th>
                {BANDS.map((b) => <th key={b} className="text-end">{t(`m37.ep.band.${b}`)}</th>)}
                <th className="text-end">{t('m37.ep.col.successors')}</th>
                <th className="text-end">{t('m37.ep.col.ready', { date: f.date(next.date) })}</th>
                <th className="text-end">{t('m37.ep.col.authorised')}</th>
                {RETENTION_MONTHS.map((m) => <th key={m} className="text-end">{t('m37.ep.col.retention', { n: f.num(m) })}</th>)}
                <th className="text-end"><span className="sr-only">{t('m37.ep.col.why')}</span></th>
              </tr>
            </thead>
            <tbody>
              {[...d.areas, tot].map((a) => <AreaRow key={a.family_id ?? 'total'} a={a} name={fam(a.family_id)} nextIdx={d.total.ready_by.indexOf(next)} />)}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">{t('m37.ep.areasNote', { min: f.num(d.min_group) })}</p>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={<span className="inline-flex flex-wrap items-center gap-2">{t('m37.ep.progressionTitle')}<Simulated label={t('m37.ep.mirror')} /></span>} description={t('m37.ep.progressionIntro')}>
          <div className="space-y-3" data-testid="m37-ep-progression" data-simulated="true">
            <BarChart title={t('m37.ep.progressionTitle')} data={tot.progression.by_year.map((x) => ({ label: yr(x.year), value: x.n, suppressed: x.n == null }))} />
            <Callout tone="sim" title={t('m37.ep.mirrorStatusTitle')}><span data-testid="m37-ep-not-authority">{t('m37.ep.mirrorStatusBody')}</span></Callout>
          </div>
        </Section>
        <Section title={t('m37.ep.rolesTitle')} description={t('m37.ep.rolesIntro')}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m37-ep-roles">
            {d.roles.map((r) => (
              <Card as="li" key={r.role_id} padded>
                <div className="flex flex-col gap-1.5" data-testid="m37-ep-role" data-role={r.role_id}>
                  <L to={`/careers/roles/${r.role_id}`} className="font-semibold">{pick(r as unknown as Row, 'title')}</L>
                  <span className="text-[11.5px] text-ink-3">{fam(r.family_id)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {r.critical && <StatusPill tone="accent">{t('m37.ep.critical')}</StatusPill>}
                    {r.future && <StatusPill tone="info">{t('m37.ep.future')}</StatusPill>}
                    {r.regulated && <StatusPill tone="neutral">{t('m37.ep.authorisedRole')}</StatusPill>}
                    {!r.slate && <StatusPill tone="sim">{t('m37.ep.noSlate')}</StatusPill>}
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        </Section>
      </div>

      <Section title={t('m37.ep.methodTitle')}>
        <ul className="space-y-1.5 text-[13px] text-ink-2" data-testid="m37-ep-method">
          {(['roles', 'successors', 'readyBy', 'authorised', 'retention', 'suppression', 'protected'] as const).map((k) => (
            <li key={k} className="flex gap-2"><Icon name="info" size={14} /><span>{t(`m37.ep.method.${k}`, { min: f.num(d.min_group) })}</span></li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-ink-3">{t('m37.ep.asOf', { date: f.date(d.as_of), method: d.method })}</p>
      </Section>
    </div>
  );
}

function AreaRow({ a, name, nextIdx }: { a: EpArea; name: string; nextIdx: number }) {
  const t = useT();
  const f = useFormat();
  const total = a.family_id === null;
  return (
    <tr className={`border-t border-line ${total ? 'font-semibold' : ''}`} data-testid="m37-ep-area" data-family={a.family_id ?? 'total'}>
      <td className="py-1.5 text-start">{name}</td>
      <td className="num text-end">{f.num(a.roles)}</td>
      {BANDS.map((b) => <td key={b} className="text-end"><N v={a.successors.bands[b]} /></td>)}
      <td className="text-end"><N v={a.successors.emirati} />{a.successors.share_pct != null && <span className="block text-[11px] text-ink-3">{t('m37.ep.ofSuccessors', { pct: f.pct(a.successors.share_pct) })}</span>}</td>
      <td className="text-end"><N v={a.ready_by[nextIdx]?.n ?? null} /></td>
      <td className="text-end"><N v={a.progression.emirati} /></td>
      {a.retention.map((x) => (
        <td key={x.months} className="text-end"><N v={x.pct} pct />{x.all_pct != null && <span className="block text-[11px] text-ink-3">{t('m37.ep.vsAll', { pct: f.pct(x.all_pct) })}</span>}</td>
      ))}
      <td className="text-end"><WhyThis reasons={areaReasons(a)} testId="m37-ep-why" /></td>
    </tr>
  );
}

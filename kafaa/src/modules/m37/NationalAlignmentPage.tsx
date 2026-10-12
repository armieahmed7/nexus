// FS62 /national/alignment (national_alignment R/Agg/W/A): the national-strategy alignment layer. Six strategies (NES 2031, We the UAE 2031,
// National AI Strategy 2031, Net Zero 2050, Jahiz groups, UAE Centennial 2071) with their pillars, goals and groups; each tag cites the most
// official source the research pack gives, flagged when it is secondary or indirect. Every count on the page is the national report RPC
// filtering the live data (nationalReport = kafaa_na_report_core): nothing is typed or stored. People counts only for HR and admins
// (Agg/W/A), suppressed under 10.
import { useMemo } from 'react';
import { Page, Section, Card, Async, StatTile, BenchmarkChips, BarChart, Heatmap, Icon, StatusPill, EmptyState } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { Can } from '../../auth/guards';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ITEM_KINDS, STRATEGIES, tagSourceView, type NationalReport, type TagRow } from './national';
import { NotGovernmentCallout, STRATEGY_ICON, SourceStanding, useNaRef, type NaRef } from './ui';

export default function NationalAlignmentPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useNaRef();
  const rep = useQuery(['national_tags', 'tag_links', 'skills', 'person_skills', 'cec_competences'], () => repo.rpc.nationalReport({}), []);
  return (
    <Page title={t('m37.routes.national-alignment.title')} intro={t('m37.hub.intro')} wide eyebrow={<BenchmarkChips feature="FS62" />}
      actions={<div className="flex flex-wrap gap-2">
        <L to="/national/report" className="btn-primary btn-sm no-underline" data-testid="m37-hub-report"><Icon name="chart" size={14} />{t('m37.hub.toReport')}</L>
        <L to="/national/occupations" className="btn-outline btn-sm no-underline">{t('m37.hub.toOccupations')}</L>
        <Can res="national_alignment" levels={['W', 'A']}><L to="/admin/national-tags" className="btn-ghost btn-sm no-underline" data-testid="m37-hub-admin">{t('m37.hub.toAdmin')}</L></Can>
      </div>}>
      <Async state={ref}>{(d) => (
        <Async state={rep} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.none')} />}>{(r) => (r ? <Hub d={d} r={r} /> : null)}</Async>
      )}</Async>
    </Page>
  );
}

function Hub({ d, r }: { d: NaRef; r: NationalReport }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const tag = (id: string) => d.tags.find((x) => x.id === id);
  const roots = r.tags.filter((s) => s.kind === 'strategy');
  const uniq = (kind: string) => new Set(r.items.filter((i) => i.kind === kind).map((i) => `${i.target_table}|${i.target_id}`)).size;
  const derived = r.items.filter((i) => i.basis !== 'curated').length;
  const flagged = r.tags.filter((s) => { const x = tag(s.tag_id); return !!x && !!tagSourceView(x.sources ?? [], x.source_scope)?.flagged; }).length;
  const matrix = useMemo(() => Object.fromEntries(roots.map((s) => [s.tag_id, s])), [roots]);
  return (
    <div className="space-y-6" data-testid="m37-hub">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="m37-hub-tiles">
        <StatTile label={t('m37.hub.tile.strategies')} value={f.num(roots.length)} sub={t('m37.hub.tile.strategiesSub', { n: f.num(r.tags.length) })} />
        <StatTile label={t('m37.hub.tile.skills')} value={f.num(uniq('skill'))} sub={t('m37.hub.tile.skillsSub', { n: f.num(derived) })} tone="info" />
        <StatTile label={t('m37.hub.tile.programmes')} value={f.num(uniq('programme'))} sub={t('m37.hub.tile.programmesSub')} />
        <StatTile label={t('m37.hub.tile.targets')} value={f.num(uniq('target'))} sub={t('m37.hub.tile.targetsSub')} tone="ok" />
        <StatTile label={t('m37.hub.tile.flagged')} value={f.num(flagged)} sub={t('m37.hub.tile.flaggedSub')} tone="sim" />
      </div>
      <NotGovernmentCallout />
      <Section title={t('m37.hub.strategiesTitle')} description={t('m37.hub.strategiesIntro')}>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="m37-hub-strategies">
          {STRATEGIES.map((sid) => {
            const s = roots.find((x) => x.strategy === sid);
            const tg = s ? tag(s.tag_id) : undefined;
            if (!s || !tg) return null;
            const kids = d.tags.filter((x) => x.parent_id === tg.id && x.status === 'active');
            return (
              <Card as="li" key={sid} className="flex flex-col" eyebrow={<span className="inline-flex items-center gap-1.5"><Icon name={STRATEGY_ICON[sid] ?? 'info'} size={13} />{t(`m37.strategy.${sid}`)}</span>}
                title={<L to={`/national/alignment/${tg.id}`} data-testid="m37-hub-strategy-link">{pick(tg, 'name')}</L>}>
                <div className="flex flex-1 flex-col gap-3" data-testid="m37-hub-strategy" data-strategy={sid}>
                  <p className="text-[13px] text-ink-2">{pick(tg, 'summary')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tg.horizon_year != null && <StatusPill tone="neutral">{t('m37.horizon', { year: f.num(tg.horizon_year, { useGrouping: false }) })}</StatusPill>}
                    <SourceStanding tag={tg} compact />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center" data-testid="m37-hub-counts">
                    {(['skills', 'programmes', 'targets'] as const).map((k) => (
                      <div key={k} className="rounded-card bg-sunken px-2 py-1.5"><dt className="caps text-[10.5px] text-ink-3">{t(`m37.count.${k}`)}</dt><dd className="num text-lg font-semibold">{f.num(s[k])}</dd></div>
                    ))}
                  </dl>
                  {r.measures && <p className="text-[12.5px] text-ink-2" data-testid="m37-hub-reach">{t('m37.hub.reach')}: <span className="num font-semibold">{s.reach == null ? t('common.suppressedShort') : f.num(s.reach)}</span></p>}
                  {kids.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {kids.map((k) => <li key={k.id}><L to={`/national/alignment/${k.id}`} className="chip border-line bg-panel normal-case tracking-normal no-underline">{pick(k, 'name')}</L></li>)}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t('m37.hub.matrixTitle')} description={t('m37.hub.matrixIntro')}>
          <div data-testid="m37-hub-matrix">
            <Heatmap title={t('m37.hub.matrixTitle')} rows={roots.map((s) => s.tag_id)} cols={[...ITEM_KINDS]}
              rowLabel={(id) => { const x = tag(id); return x ? pick(x, 'name') : id; }} colLabel={(k) => t(`m37.kind.${k}`)}
              value={(row, col) => { const s = matrix[row]; const v = col === 'skill' ? s.skills : col === 'programme' ? s.programmes : s.targets; return { v, tone: v ? 'info' : 'neutral' }; }} />
          </div>
        </Section>
        <Section title={t('m37.hub.jahizTitle')} description={t('m37.hub.jahizIntro')}>
          <div data-testid="m37-hub-jahiz">
            <BarChart title={t('m37.hub.jahizTitle')} data={r.tags.filter((s) => s.strategy === 'jahiz' && s.kind === 'group').map((s) => ({ label: pick(tag(s.tag_id) as TagRow, 'name'), value: s.skills }))} />
            <p className="mt-2 text-[12.5px] text-ink-3">{t('m37.hub.jahizNote')}</p>
          </div>
        </Section>
      </div>
    </div>
  );
}

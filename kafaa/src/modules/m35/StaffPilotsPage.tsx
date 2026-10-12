// FS61 /skills/pilots (staff: internal_content R): published pilot results, failures included, with the adoption rate against the Future
// Skills Centre reference (from kafaa_benchmarks). A named evaluator also sees "Pilots I evaluate" (own_profile on evaluator_person_id) and
// signs off a running pilot there (rpc.signoffPilot: the named evaluator only; audit + ledger).
import { useState } from 'react';
import { useSession } from '../../auth/session';
import { Page, Section, Async, EmptyState, Callout, SimChip, BenchmarkChips, Tabs } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { PilotStatusPill, SignoffForm } from './fs60ui';
import { AdoptionKpi, PilotResultCard, usePilots } from './pilotsUi';
import type { Row } from './ui';

export default function StaffPilotsPage() {
  const t = useT();
  const q = usePilots();
  return (
    <Page title={t('m35.routes.skills-pilots.title')} intro={t('m35.spp.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS61" /><SimChip /></div>}>
      <Async state={q}>{(d) => <Body pilots={d.pilots} stats={d.stats} />}</Async>
    </Page>
  );
}

function Body({ pilots, stats }: { pilots: Row[]; stats: import('./backend/rpc').PilotStats }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const published = pilots.filter((p) => p.published);
  const mine = pilots.filter((p) => p.evaluator_person_id === me);
  const [result, setResult] = useState('all');
  // until the person picks a tab, a named evaluator with a running pilot lands on 'Pilots I evaluate'
  const [tab, setTab] = useState<string | null>(null);
  const shown = published.filter((p) => result === 'all' || p.result === result);
  const results = (
    <div className="space-y-4">
      <AdoptionKpi s={stats} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('m35.sp.col.result')}>
        {['all', 'success', 'mixed', 'failed'].map((r) => (
          <button key={r} type="button" className={`btn-sm ${result === r ? 'btn-primary' : 'btn-outline'}`} aria-pressed={result === r} onClick={() => setResult(r)} data-testid={`m35-spp-filter-${r}`}>
            {r === 'all' ? t('m35.sp.allResults') : t(`m35.sp.result.${r}`)}
          </button>
        ))}
      </div>
      {shown.length ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m35-spp-list">{shown.map((p) => <PilotResultCard key={p.id} p={p} />)}</div> : <EmptyState title={t('m35.spp.none')} />}
      <Callout tone="sim" title={t('m35.sp.failures.title')}>{t('m35.sp.failures.body')}</Callout>
    </div>
  );
  const evaluate = (
    <div className="space-y-3" data-testid="m35-spp-mine">
      {mine.length ? mine.map((p) => (
        <Section key={p.id} title={pick(p, 'title')} actions={<PilotStatusPill status={p.status} />}>
          <p className="mb-2 text-[13px] text-ink-2">{pick(p, 'hypothesis')}</p>
          {p.status === 'running' ? <SignoffForm pilot={p} /> : <p className="text-[12.5px] text-ink-3">{p.signoff_at ? t('m35.spp.signed', { date: f.date(p.signoff_at) }) : t('m35.spp.notRunning')}</p>}
        </Section>
      )) : <EmptyState title={t('m35.spp.noneMine')} />}
    </div>
  );
  return (
    <div data-testid="m35-spp">
      <Tabs tabs={[
        { id: 'results', label: t('m35.spp.tab.results'), content: results, badge: <span className="num">{f.num(published.length)}</span> },
        { id: 'evaluate', label: t('m35.spp.tab.evaluate'), content: evaluate, badge: mine.length ? <span className="num">{f.num(mine.length)}</span> : undefined },
      ]} value={tab ?? (mine.some((p) => p.status === 'running') ? 'evaluate' : 'results')} onChange={setTab} />
    </div>
  );
}

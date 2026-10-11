// FS17/FS18 in the Learning Coach: pathways ranked against my 2030 role gaps as well as today's (rankPathways; every card carries
// reasons for <WhyThis>), and external catalogue picks for the same skills with the "external" chip. Used by /my/coach (tab) and
// /my/pathways. Deterministic; the engine kernel's model slot is not used here.
import { useState } from 'react';
import { Async, EmptyState, Callout, BenchmarkChips } from '../../ui';
import { L, useT } from '../../i18n';
import { CoachPathwayCard, CompleteExternalModal, ExternalCard, useFsCoach, useMyCompletions, usePwRef, type Row } from './fsui';

export function FutureSkillsCoach({ compact }: { compact?: boolean }) {
  const t = useT();
  const ref = usePwRef();
  const q = useFsCoach();
  const mine = useMyCompletions();
  const [record, setRecord] = useState<Row | null>(null);
  return (
    <Async state={ref}>{(d) => (
      <Async state={q} isEmpty={(x) => !x} empty={<EmptyState title={t('m19.pw.coach.none')}>{t('m19.pw.coach.noneBody')}</EmptyState>}>{(x) => x && (
        <div className="space-y-5" data-testid="m19-fs-coach">
          {!compact && <div className="flex flex-wrap items-center gap-2" data-testid="m19-fs-coach-bench"><BenchmarkChips feature="FS17" /><BenchmarkChips feature="FS18" /></div>}
          {!compact && <p className="text-[13.5px] text-ink-2">{t(x.has2030 ? 'm19.pw.coach.intro2030' : 'm19.pw.coach.introNow')}</p>}
          {x.ranked.length ? (
            <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m19-fs-coach-list">
              {x.ranked.map((r, i) => <CoachPathwayCard key={r.id} id={r.id} reasons={r.reasons} skills={d.skills} pathways={d.pathways} n={i + 1} />)}
            </ol>
          ) : <EmptyState icon="sparkle" title={t('m19.pw.coach.empty')} action={<L to="/learn/pathways" className="btn-outline btn-sm">{t('m19.pw.my.browse')}</L>}>{t('m19.pw.coach.emptyBody')}</EmptyState>}
          {x.externalPicks.length > 0 && (
            <div>
              <h3 className="caps mb-2">{t('m19.pw.coach.externalTitle')}</h3>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m19-fs-coach-external">
                {x.externalPicks.map((r) => { const xr = d.externals.find((e) => e.id === r.id); return xr ? <ExternalCard key={r.id} x={xr} skills={d.skills} mine={mine.get(r.id) ?? null} onRecord={() => setRecord(xr)} reasons={r.reasons} /> : null; })}
              </ul>
            </div>
          )}
          {!compact && <Callout title={t('m19.pw.coach.howTitle')}>{t('m19.pw.coach.howBody')}</Callout>}
          <CompleteExternalModal resource={record} open={!!record} onClose={() => setRecord(null)} />
        </div>
      )}</Async>
    )}</Async>
  );
}

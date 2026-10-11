// FS40 /my/twin-drills (skills_profile Own): digital-twin diagnosis drills. Each drill shows synthetic SIMULATED sensor trends from a
// digital twin of a plant system; you spend a limited check budget, name the degrading component and failure mode, choose a
// conservative action and justify it. Scored server-side with reasons; a pass writes assessment evidence for the twin and plant-data
// skills at level 1 or 2, never higher; the latest attempt on a drill replaces the earlier evidence.
import type { ReactNode } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, EngineBadge, StatusPill, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { TWIN_EVIDENCE_CAP } from './twin';
import type { Row } from './ui';

export function useTwins(personId: string | null) {
  const repo = useRepo();
  return useQuery(['twin_scenarios', 'twin_attempts', 'skill_evidence'], async () => {
    const [scenarios, attempts, skills] = await Promise.all([
      (repo.list('twin_scenarios', { filter: { status: 'published' }, order: [['sort', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('twin_attempts', { filter: { person_id: personId ?? '__none__' }, order: [['submitted_at', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('skills') as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    return { scenarios, attempts, skills: new Map(skills.map((s) => [s.id as string, s])) };
  }, [personId]);
}

export function Dots({ n }: { n: number }) {
  const t = useT();
  return <span className="inline-flex items-center gap-0.5" aria-label={t('m31.tw.difficulty', { n })}>{[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-3 rounded-full ${i <= n ? 'bg-[rgb(var(--accent))]' : 'bg-sunken'}`} />)}</span>;
}

export default function TwinDrillsPage() {
  const t = useT();
  const s = useSession();
  const q = useTwins(s.identity.personId);
  const eng = useEngine('assess');
  return (
    <Page title={t('m31.routes.my-twin-drills.title')} intro={t('m31.tw.intro')} wide eyebrow={<BenchmarkChips feature="FS40" />}
      actions={<L to="/learn/plant-literacy" className="btn-outline btn-sm no-underline">{t('m31.tw.toExplainer')}</L>}>
      <Async state={q}>{(d) => (d.scenarios.length ? <Body d={d} engine={<EngineBadge engine={eng} />} /> : <EmptyState title={t('m31.tw.none')} />)}</Async>
    </Page>
  );
}

function Body({ d, engine }: { d: { scenarios: Row[]; attempts: Row[]; skills: Map<string, Row> }; engine: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const latest = (id: string) => d.attempts.filter((a) => a.scenario_id === id).sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))).pop();
  const passed = d.scenarios.filter((x) => latest(x.id)?.passed);
  const best = passed.reduce((m, x) => Math.max(m, Number(latest(x.id)?.level ?? 0)), 0);
  return (
    <div className="space-y-6">
      <Callout tone="sim" title={t('m31.tw.simTitle')}><span data-testid="m31-tw-synthetic">{t('m31.tw.simBody')}</span> <span className="ms-1 inline-block align-middle">{engine}</span></Callout>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m31-tw-tiles">
        <StatTile label={t('m31.tw.tile.drills')} value={f.num(d.scenarios.length)} />
        <StatTile label={t('m31.tw.tile.passed')} value={`${f.num(passed.length)} / ${f.num(d.scenarios.length)}`} tone="ok" />
        <StatTile label={t('m31.tw.tile.level')} value={best ? t('m31.tw.levelN', { n: f.num(best) }) : '—'} sub={t('m31.tw.tile.levelSub', { cap: f.num(TWIN_EVIDENCE_CAP) })} />
        <StatTile label={t('m31.tw.tile.attempts')} value={f.num(d.attempts.length)} />
      </div>
      <Section title={t('m31.tw.list.title')} description={t('m31.tw.list.intro')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m31-tw-list">
          {d.scenarios.map((x) => {
            const a = latest(x.id);
            return (
              <li key={x.id} className="card flex min-w-0 flex-col gap-2 p-4" data-testid="m31-tw-card" data-id={x.id} data-state={a ? (a.passed ? 'passed' : 'not_yet') : 'new'}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-semibold">{pick(x, 'title')}</span>
                  {a ? <StatusPill tone={a.passed ? 'ok' : 'sim'}>{a.passed ? t('m31.tw.passedL', { n: f.num(a.level) }) : t('m31.tw.notYet')}</StatusPill> : <StatusPill tone="neutral">{t('m31.tw.new')}</StatusPill>}
                </div>
                <p className="text-[13px] text-ink-2">{pick(x, 'summary')}</p>
                <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
                  <Dots n={Number(x.difficulty)} />
                  <span>{t('m31.tw.upTo', { n: f.num(Number(x.level)) })}</span>
                  <span>{t('m31.tw.minutes', { n: f.num(Number(x.est_minutes)) })}</span>
                  <span className="font-mono">{x.code}</span>
                </div>
                <ul className="flex flex-wrap gap-1">{(x.skill_ids as string[]).map((id) => <li key={id} className="chip border-line bg-sunken normal-case tracking-normal text-ink-2">{d.skills.get(id) ? pick(d.skills.get(id), 'name') : id}</li>)}</ul>
                {a && <p className="text-[12px] text-ink-3">{t('m31.tw.last', { pct: f.pct(Number(a.pct), 0), date: f.date(String(a.submitted_at)) })}</p>}
                <div className="mt-auto"><L to={`/my/twin-drills/${x.id}`} className="btn-primary btn-sm no-underline" data-testid="m31-tw-start"><Icon name="chart" size={14} /> {a ? t('m31.tw.retake') : t('m31.tw.start')}</L></div>
              </li>
            );
          })}
        </ul>
      </Section>
      <Card title={t('m31.tw.scoring.title')} eyebrow={t('m31.tw.scoring.eyebrow')}>
        <ul className="list-disc space-y-1 ps-4 text-[13px] text-ink-2" data-testid="m31-tw-scoring">
          {['component', 'checks', 'action', 'rationales', 'unsafe', 'pass', 'level', 'latest'].map((k) => <li key={k}>{t(`m31.tw.scoring.${k}`)}</li>)}
        </ul>
      </Card>
    </div>
  );
}

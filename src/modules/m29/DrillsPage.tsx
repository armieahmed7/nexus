// FS37 /my/ai-fluency/drills (ai_literacy Own): governed AI sandbox drills. Each drill puts an AI-styled summary next to a synthetic
// controlled procedure: find the planted errors, name them, then follow the challenge protocol. Browser-only and deterministic (no model
// call, no LLM key); scored server-side with reasons; a pass writes AI output verification evidence at level 1 or 2, never higher.
import type { ReactNode } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, EngineBadge, StatusPill, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ERROR_KINDS } from './drills';
import { Difficulty } from './fs36ui';
import type { Row } from './ui';

export function useDrills(personId: string | null) {
  const repo = useRepo();
  return useQuery(['ai_drills', 'ai_drill_attempts', 'skill_evidence'], async () => {
    const [drills, attempts] = await Promise.all([
      (repo.list('ai_drills' as never, { filter: { status: 'published' }, order: [['sort', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('ai_drill_attempts' as never, { filter: { person_id: personId ?? '__none__' }, order: [['submitted_at', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    return { drills, attempts };
  }, [personId]);
}

export default function DrillsPage() {
  const t = useT();
  const s = useSession();
  const q = useDrills(s.identity.personId);
  const eng = useEngine('assess');
  return (
    <Page title={t('m29.routes.my-ai-drills.title')} intro={t('m29.dr.intro')} wide eyebrow={<BenchmarkChips feature="FS37" />}
      actions={<L to="/my/ai-fluency" className="btn-outline btn-sm no-underline">{t('m29.dr.toFluency')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => (d.drills.length ? <Body drills={d.drills} attempts={d.attempts} engine={<EngineBadge engine={eng} />} /> : <EmptyState title={t('m29.dr.none')} />)}</Async>
    </Page>
  );
}

function Body({ drills, attempts, engine }: { drills: Row[]; attempts: Row[]; engine: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const latest = (id: string) => attempts.filter((a) => a.drill_id === id).sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))).pop();
  const passedNow = drills.filter((d) => latest(d.id)?.passed);
  const best = passedNow.reduce((m, d) => Math.max(m, Number(latest(d.id)?.level ?? 0)), 0);
  return (
    <div className="space-y-6">
      <Callout tone="sim" title={t('m29.dr.synthetic.title')}><span data-testid="m29-dr-synthetic">{t('m29.dr.synthetic.body')}</span> <span className="ms-1 inline-block align-middle">{engine}</span></Callout>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m29-dr-tiles">
        <StatTile label={t('m29.dr.tile.drills')} value={f.num(drills.length)} />
        <StatTile label={t('m29.dr.tile.passed')} value={`${f.num(passedNow.length)} / ${f.num(drills.length)}`} tone="ok" />
        <StatTile label={t('m29.dr.tile.level')} value={best ? t('m29.dr.levelN', { n: f.num(best) }) : '—'} sub={t('m29.dr.tile.levelSub')} />
        <StatTile label={t('m29.dr.tile.attempts')} value={f.num(attempts.length)} />
      </div>
      <Section title={t('m29.dr.list.title')} description={t('m29.dr.list.intro')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m29-dr-list">
          {drills.map((d) => {
            const a = latest(d.id);
            return (
              <li key={d.id} className="card flex min-w-0 flex-col gap-2 p-4" data-testid="m29-dr-card" data-id={d.id} data-state={a ? (a.passed ? 'passed' : 'not_yet') : 'new'}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-semibold">{pick(d, 'title')}</span>
                  {a ? <StatusPill tone={a.passed ? 'ok' : 'sim'}>{a.passed ? t('m29.dr.passedL', { n: f.num(a.level) }) : t('m29.dr.notYet')}</StatusPill> : <StatusPill tone="neutral">{t('m29.dr.new')}</StatusPill>}
                </div>
                <p className="text-[13px] text-ink-2">{pick(d, 'summary')}</p>
                <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
                  <Difficulty n={Number(d.difficulty)} />
                  <span>{t('m29.dr.upTo', { n: f.num(Number(d.level)) })}</span>
                  <span>{t('m29.dr.minutes', { n: f.num(Number(d.est_minutes)) })}</span>
                  <span className="font-mono">{d.doc?.code}</span>
                </div>
                {a && <p className="text-[12px] text-ink-3">{t('m29.dr.last', { pct: f.pct(Number(a.pct), 0), date: f.date(String(a.submitted_at)) })}</p>}
                <div className="mt-auto"><L to={`/my/ai-fluency/drills/${d.id}`} className="btn-primary btn-sm no-underline" data-testid="m29-dr-start"><Icon name="check" size={14} /> {a ? t('m29.dr.retake') : t('m29.dr.start')}</L></div>
              </li>
            );
          })}
        </ul>
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.dr.kinds.title')} eyebrow={t('m29.dr.kinds.eyebrow')}>
          <dl className="grid grid-cols-1 gap-2 text-[13px]" data-testid="m29-dr-kinds">
            {ERROR_KINDS.map((k) => <div key={k}><dt className="font-semibold">{t(`m29.dr.kind.${k}`)}</dt><dd className="text-ink-2">{t(`m29.dr.kindHelp.${k}`)}</dd></div>)}
          </dl>
        </Card>
        <Card title={t('m29.dr.scoring.title')} eyebrow={t('m29.dr.scoring.eyebrow')}>
          <ul className="list-disc space-y-1 ps-4 text-[13px] text-ink-2" data-testid="m29-dr-scoring">
            {['found', 'kind', 'false', 'protocol', 'pass', 'level', 'latest'].map((k) => <li key={k}>{t(`m29.dr.scoring.${k}`)}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

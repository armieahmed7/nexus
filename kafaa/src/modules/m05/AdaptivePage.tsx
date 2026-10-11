// FS21 /my/assessments/adaptive (skills_profile Own): my adaptive future-skills assessments. Six banks, each criterion-referenced
// (safety-related: meets the standard or not, never a percentile) or developmental (percentile against 10+ colleagues). Each card shows
// my latest result with a benchmark line (ENEC average or the standard), the skills it evidences, the credentials it gates and when I can
// start or retake. Routing and scoring run server-side on the FS01 `assess` engine (rpc.adaptiveOverview; SQL kafaa_ad_* = adaptive.ts).
import { Page, Section, Card, Async, Callout, EmptyState, DataTable, BenchmarkChips, BenchmarkLine, StatusPill, EngineBadge, Icon, StatTile, type Column } from '../../ui';
import { useEngine, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import type { AdBankCard } from './backend/rpc';
import { GateChips, LevelPill, ModeChip, SkillLinks, useFsRef, type FsRef, type Row } from './fsui';

export default function AdaptivePage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const ref = useFsRef();
  const eng = useEngine('assess');
  const q = useQuery(['adaptive_attempts', 'integrity_reports'], async () => {
    const [ov, attempts, reports] = await Promise.all([
      repo.rpc.adaptiveOverview(),
      repo.list('adaptive_attempts' as never, { filter: { person_id: s.identity.personId ?? '__none__' } } as never).catch(() => [] as Row[]),
      repo.list('integrity_reports' as never, { filter: { person_id: s.identity.personId ?? '__none__' } } as never).catch(() => [] as Row[]),
    ]);
    return { ov, attempts: attempts as Row[], reports: reports as Row[] };
  }, [s.identity.personId]);
  return (
    <Page title={t('m05.routes.my-adaptive.title')} intro={t('m05.ad.intro')} wide eyebrow={<BenchmarkChips feature="FS21" />}
      actions={<L to="/my/assessments/tasks" className="btn-outline btn-sm no-underline" data-testid="m05-ad-to-tasks"><Icon name="chart" size={14} /> {t('m05.ad.toTasks')}</L>}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => (c.ov ? <Body d={d} cards={c.ov.banks} attempts={c.attempts} reports={c.reports} engine={<EngineBadge engine={eng} />} /> : <EmptyState title={t('m05.ad.none')} />)}</Async>}</Async>
    </Page>
  );
}

function Body({ d, cards, attempts, reports, engine }: { d: FsRef; cards: AdBankCard[]; attempts: Row[]; reports: Row[]; engine: React.ReactNode }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const done = attempts.filter((a) => a.status === 'completed');
  const bankName = (id: string) => { const b = d.banks.find((x: Row) => x.id === id); return b ? pick(b, 'name') : id; };
  const cols: Column<Row>[] = [
    { key: 'bank', header: t('m05.ad.hist.bank'), value: (a) => bankName(a.bank_id), sortable: true },
    { key: 'date', header: t('m05.ad.hist.date'), value: (a) => a.completed_at, render: (a) => f.date(a.completed_at), sortable: true },
    { key: 'items', header: t('m05.ad.hist.items'), value: (a) => a.item_count, render: (a) => f.num(a.item_count), align: 'end' },
    { key: 'level', header: t('m05.ad.hist.level'), value: (a) => a.estimate, render: (a) => <LevelPill level={a.estimate} />, sortable: true },
    { key: 'result', header: t('m05.ad.hist.result'), value: (a) => (a.mode === 'criterion' ? String(a.meets) : a.percentile ?? ''), render: (a) => <ResultText a={a} /> },
    { key: 'integrity', header: t('m05.ad.hist.integrity'), value: (a) => reports.find((r) => r.attempt_id === a.id)?.status ?? '', render: (a) => {
      const r = reports.find((x) => x.attempt_id === a.id);
      return r ? <StatusPill tone={r.decision === 'voided' ? 'bad' : r.status === 'review' && !r.decision ? 'sim' : 'ok'}>{r.decision ? t(`m05.ir.decision.${r.decision}`) : t(`m05.ir.status.${r.status}`)}</StatusPill> : <span className="text-ink-3">—</span>;
    } },
    { key: 'open', header: '', csv: false, render: (a) => <L to={`/my/assessments/adaptive/${a.bank_id}?attempt=${a.id}`} className="text-[13px]">{t('m05.ad.hist.open')}</L> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('m05.ad.tile.banks')} value={f.num(cards.length)} sub={t('m05.ad.tile.banksSub', { n: f.num(cards.filter((c) => c.criterion).length) })} />
        <StatTile label={t('m05.ad.tile.taken')} value={f.num(new Set(done.map((a) => a.bank_id)).size)} sub={t('m05.ad.tile.takenSub', { n: f.num(done.length) })} />
        <StatTile label={t('m05.ad.tile.met')} value={f.num(cards.filter((c) => c.criterion && c.latest?.meets).length)} sub={t('m05.ad.tile.metSub')} tone="ok" />
        <StatTile label={t('m05.ad.tile.ready')} value={f.num(cards.filter((c) => c.can_start && !c.in_progress).length)} sub={t('m05.ad.tile.readySub')} tone="info" />
      </div>
      <Callout tone="info" title={t('m05.ad.how.title')}>
        <span className="block">{t('m05.ad.how.body')}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">{engine}<span className="text-[12px] text-ink-3">{t('m05.ad.how.engine')}</span></span>
      </Callout>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m05-ad-banks">
        {cards.map((c) => <BankCard key={c.bank_id} c={c} d={d} />)}
      </div>
      <Section title={t('m05.ad.hist.title')} description={t('m05.ad.hist.intro')}>
        {done.length ? <DataTable rows={done.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))} columns={cols} rowKey={(a) => a.id} csvName="my-adaptive-assessments.csv" searchable={false} pageSize={10} />
          : <EmptyState title={t('m05.ad.hist.none')}>{t('m05.ad.hist.noneBody')}</EmptyState>}
      </Section>
      <Callout tone="sim" title={t('m05.ad.privacy.title')}>{t('m05.ad.privacy.body')}</Callout>
    </div>
  );
}

export function ResultText({ a }: { a: Row }) {
  const t = useT();
  const f = useFormat();
  if (a.mode === 'criterion' || a.criterion) return <StatusPill tone={a.meets ? 'ok' : 'neutral'}>{t(a.meets ? 'm05.ad.meets' : 'm05.ad.notYet')}</StatusPill>;
  if (a.percentile == null) return <span className="text-[12.5px] text-ink-3">{t('m05.ad.pctSuppressed')}</span>;
  return <span className="text-[13px]">{t('m05.ad.pct', { pct: f.num(a.percentile) })}</span>;
}

function BankCard({ c, d }: { c: AdBankCard; d: FsRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const b = d.banks.find((x: Row) => x.id === c.bank_id);
  if (!b) return null;
  const lines = [
    ...(c.criterion ? [{ kind: 'target' as const, label: t('m05.ad.line.standard'), value: Number(b.cut_level) }] : []),
    ...(c.enec_avg != null ? [{ kind: 'enec' as const, label: t('m05.ad.line.enec', { n: f.num(c.enec_n ?? 0) }), value: c.enec_avg }] : []),
  ];
  return (
    <Card title={pick(b, 'name')} eyebrow={<ModeChip criterion={c.criterion} safety={c.safety} />}
      actions={c.in_progress ? <L to={`/my/assessments/adaptive/${b.id}`} className="btn-primary btn-sm no-underline" data-testid={`m05-ad-resume-${b.id}`}>{t('m05.ad.resume')}</L>
        : c.can_start ? <L to={`/my/assessments/adaptive/${b.id}`} className="btn-primary btn-sm no-underline" data-testid={`m05-ad-start-${b.id}`}>{c.latest ? t('m05.ad.retake') : t('m05.ad.start')}</L>
        : <span className="text-[12.5px] text-ink-3" data-testid={`m05-ad-next-${b.id}`}>{t('m05.ad.nextOn', { date: f.date(c.next_on) })}</span>}>
      <div className="space-y-3" data-testid={`m05-ad-bank-${b.id}`}>
        <p className="text-[13.5px] text-ink-2">{pick(b, 'summary')}</p>
        <SkillLinks ids={b.skill_ids ?? []} d={d} />
        <GateChips codes={b.gates} d={d} />
        {c.latest ? (
          <div className="space-y-2 rounded-card border border-line bg-sunken p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="flex flex-wrap items-center gap-2"><span className="text-ink-3">{t('m05.ad.latest', { date: f.date(c.latest.completed_at) })}</span><LevelPill level={c.latest.estimate} testId={`m05-ad-level-${b.id}`} /></span>
              <ResultText a={{ ...c.latest, criterion: c.criterion }} />
            </div>
            <BenchmarkLine value={c.latest.estimate} max={4} label={t('m05.ad.line.label')} lines={lines} />
            {c.criterion && c.enec_meets_pct != null && <p className="text-[12px] text-ink-3">{t('m05.ad.meetsShare', { pct: f.pct(c.enec_meets_pct), n: f.num(c.enec_n ?? 0) })}</p>}
            {c.enec_n == null && <p className="text-[12px] text-ink-3">{t('m05.ad.enecSuppressed')}</p>}
          </div>
        ) : <p className="text-[13px] text-ink-3">{t('m05.ad.notTaken')}</p>}
      </div>
    </Card>
  );
}

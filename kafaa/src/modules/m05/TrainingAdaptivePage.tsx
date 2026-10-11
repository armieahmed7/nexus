// FS21 /training/adaptive (secure_items W/A: instructors read, the training manager writes). Results per bank (suppressed under 10;
// share at level 1 or below against the OECD PIAAC line; share meeting the standard for safety-related banks), calibration and item
// exposure (SIMULATED pilot p-values vs observed), the item editor (rpc.saveAdaptiveItem: restricted wording and secure-bank copies are
// refused, two active items per level kept), attempts in my scope (skills_profile Scope/A rows) and how the engine works.
import { useMemo, useState } from 'react';
import { Page, Card, Async, Callout, EmptyState, DataTable, Tabs, BenchmarkChips, BenchmarkLine, BarChart, StatusPill, StatTile, EngineBadge, Drawer, SelectField, TextField, TextArea, SimChip, type Column } from '../../ui';
import { useEngine, useQuery, useRepo, useAction } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { NORM_MIN, levelOfDifficulty, type AdItemInput } from './adaptive';
import { LevelPill, ModeChip, useFsRef, type FsRef, type Row } from './fsui';
import { ResultText } from './AdaptivePage';
import type { AdStats } from './backend/rpc';

export default function TrainingAdaptivePage() {
  const t = useT();
  const repo = useRepo();
  const ref = useFsRef();
  const q = useQuery(['adaptive_items', 'adaptive_attempts', 'people'], async () => {
    const [stats, items, attempts, people] = await Promise.all([
      repo.rpc.adaptiveStats(), repo.list('adaptive_items' as never).catch(() => [] as Row[]), repo.list('adaptive_attempts' as never).catch(() => [] as Row[]), repo.list('people').catch(() => [] as Row[]),
    ]);
    return { stats, items: items as Row[], attempts: attempts as Row[], people: people as Row[] };
  }, []);
  return (
    <Page title={t('m05.routes.training-adaptive.title')} intro={t('m05.tr.intro')} wide eyebrow={<BenchmarkChips feature="FS21" />}>
      <Async state={ref}>{(d) => <Async state={q}>{(c) => (c.stats ? <Body d={d} {...c} stats={c.stats} reload={q.reload} /> : <EmptyState title={t('m05.tr.none')} />)}</Async>}</Async>
    </Page>
  );
}

function Body({ d, stats, items, attempts, people, reload }: { d: FsRef; stats: AdStats; items: Row[]; attempts: Row[]; people: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const eng = useEngine('assess');
  const canWrite = s.can('secure_items', ['A']);
  const bankName = (id: string) => { const b = d.banks.find((x: Row) => x.id === id); return b ? pick(b, 'name') : id; };
  const usage = new Map(stats.items.map((u) => [u.item_id, u]));
  const [edit, setEdit] = useState<Row | null>(null);
  const tested = stats.banks.reduce((n, b) => n + b.tested, 0);
  const itemCols: Column<Row>[] = [
    { key: 'id', header: t('m05.tr.items.id'), value: (i) => i.id, render: (i) => <bdi dir="ltr" className="num text-[12px]">{i.id}</bdi>, sortable: true },
    { key: 'bank', header: t('m05.tr.items.bank'), value: (i) => bankName(i.bank_id), sortable: true },
    { key: 'level', header: t('m05.tr.items.level'), value: (i) => i.level, render: (i) => <LevelPill level={i.level} />, sortable: true },
    { key: 'difficulty', header: t('m05.tr.items.difficulty'), value: (i) => Number(i.difficulty), render: (i) => f.num(Number(i.difficulty), { minimumFractionDigits: 2 }), align: 'end', sortable: true },
    { key: 'facet', header: t('m05.tr.items.facet'), value: (i) => i.facet },
    { key: 'stem', header: t('m05.tr.items.stem'), value: (i) => pick(i, 'stem'), render: (i) => <span className="line-clamp-2 max-w-[28rem]">{pick(i, 'stem')}</span> },
    { key: 'p', header: t('m05.tr.items.pPilot'), value: (i) => i.p_value, render: (i) => (i.p_value == null ? '—' : f.num(Number(i.p_value))), align: 'end' },
    { key: 'pobs', header: t('m05.tr.items.pObs'), value: (i) => usage.get(i.id)?.p_obs ?? null, render: (i) => {
      const u = usage.get(i.id);
      const drift = u?.p_obs != null && i.p_value != null && Math.abs(Number(u.p_obs) - Number(i.p_value)) > 0.25;
      return <span className="inline-flex items-center gap-1">{u?.p_obs == null ? '—' : f.num(u.p_obs)}{drift && <StatusPill tone="sim">{t('m05.tr.items.drift')}</StatusPill>}</span>;
    }, align: 'end' },
    { key: 'seen', header: t('m05.tr.items.seen'), value: (i) => usage.get(i.id)?.seen ?? 0, render: (i) => f.num(usage.get(i.id)?.seen ?? 0), align: 'end', sortable: true },
    { key: 'exposure', header: t('m05.tr.items.exposure'), value: (i) => usage.get(i.id)?.exposure ?? 0, render: (i) => f.pct(usage.get(i.id)?.exposure ?? 0, 0), align: 'end', sortable: true },
    { key: 'status', header: t('m05.tr.items.status'), value: (i) => i.status, render: (i) => <StatusPill status={i.status}>{t(`m05.tr.items.st.${i.status}`)}</StatusPill> },
    ...(canWrite ? [{ key: 'edit', header: '', csv: false, render: (i: Row) => <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(i)} data-testid={`m05-tr-edit-${i.id}`}>{t('m05.tr.items.edit')}</button> }] : []),
  ];
  const personName = (id: string) => { const p = people.find((x) => x.id === id); return p ? pick(p, 'display_name') || p.display_name : id; };
  const attCols: Column<Row>[] = [
    { key: 'person', header: t('m05.tr.att.person'), value: (a) => personName(a.person_id), sortable: true },
    { key: 'bank', header: t('m05.tr.items.bank'), value: (a) => bankName(a.bank_id), sortable: true },
    { key: 'date', header: t('m05.ad.hist.date'), value: (a) => a.completed_at ?? a.started_at, render: (a) => f.date(a.completed_at ?? a.started_at), sortable: true },
    { key: 'items', header: t('m05.ad.hist.items'), value: (a) => a.item_count, align: 'end' },
    { key: 'level', header: t('m05.ad.hist.level'), value: (a) => a.estimate, render: (a) => (a.status === 'completed' ? <LevelPill level={a.estimate} /> : <StatusPill tone="info">{t('m05.tr.att.open')}</StatusPill>) },
    { key: 'result', header: t('m05.ad.hist.result'), value: (a) => a.meets ?? a.percentile ?? '', render: (a) => (a.status === 'completed' ? <ResultText a={a} /> : null) },
    { key: 'counts', header: t('m05.tr.att.counts'), value: (a) => (a.counts === false ? 'voided' : ''), render: (a) => (a.counts === false ? <StatusPill tone="bad">{t('m05.ir.decision.voided')}</StatusPill> : null) },
  ];
  const tabs = [
    {
      id: 'results', label: t('m05.tr.tab.results'), content: (
        <div className="space-y-4" data-testid="m05-tr-results">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t('m05.tr.tile.banks')} value={f.num(stats.banks.length)} />
            <StatTile label={t('m05.tr.tile.items')} value={f.num(items.filter((i) => i.status === 'active').length)} sub={t('m05.tr.tile.itemsSub')} />
            <StatTile label={t('m05.tr.tile.tested')} value={f.num(tested)} sub={t('m05.tr.tile.testedSub')} />
            <StatTile label={t('m05.tr.tile.gating')} value={f.num(d.banks.filter((b: Row) => (b.gates ?? []).length).length)} sub={t('m05.tr.tile.gatingSub')} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {stats.banks.map((b) => {
              const bank = d.banks.find((x: Row) => x.id === b.bank_id);
              return (
                <Card key={b.bank_id} title={bankName(b.bank_id)} eyebrow={<ModeChip criterion={b.criterion} safety={!!bank?.safety_related} />} actions={<span className="num text-[12.5px] text-ink-3">{b.n == null ? t('m05.tr.suppressed', { min: f.num(NORM_MIN) }) : t('m05.tr.tested', { n: f.num(b.n) })}</span>}>
                  <div className="space-y-3" data-testid={`m05-tr-bank-${b.bank_id}`}>
                    {b.n == null ? <p className="text-[13px] text-ink-3">{t('m05.tr.suppressedBody', { min: f.num(NORM_MIN) })}</p> : (
                      <>
                        <BarChart title={t('m05.tr.dist', { bank: bankName(b.bank_id) })} data={b.dist.map((x) => ({ label: t(`m05.ad.level.${x.level}`), value: x.n ?? 0, tone: x.n == null ? 'neutral' : x.level >= Number(bank?.cut_level ?? 2) ? 'ok' : 'info' }))} />
                        {b.dist.some((x) => x.n == null) && <p className="text-[12px] text-ink-3">{t('m05.tr.cellsSuppressed', { min: f.num(NORM_MIN) })}</p>}
                        {b.criterion
                          ? <BenchmarkLine value={b.pct_meets} max={100} unit="pct" label={t('m05.tr.meetsLine')} lines={[{ kind: 'target', label: t('m05.tr.meetsTarget'), value: 100 }]} />
                          : <BenchmarkLine value={b.pct_low} max={100} unit="pct" label={t('m05.tr.lowLine')} benchmark={{ id: 'OECD-PIAAC', figure: 'adults_level1_or_below' }} />}
                        {!b.criterion && <p className="text-[12px] text-ink-3">{t('m05.tr.lowNote')}</p>}
                        {b.criterion && <p className="text-[12px] text-ink-3">{t('m05.tr.criterionNote')}</p>}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'items', label: t('m05.tr.tab.items'), badge: f.num(items.length), content: (
        <div className="space-y-3" data-testid="m05-tr-items">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[12.5px] text-ink-3"><SimChip label={t('m05.tr.items.pilot')} />{t('m05.tr.items.note')}</span>
            {canWrite && <button type="button" className="btn-primary btn-sm" onClick={() => setEdit({})} data-testid="m05-tr-add">{t('m05.tr.items.add')}</button>}
          </div>
          {!canWrite && <Callout tone="info" title={t('m05.tr.items.readOnlyTitle')}>{t('m05.tr.items.readOnly')}</Callout>}
          <DataTable rows={items} columns={itemCols} rowKey={(i) => i.id} csvName="adaptive-items-calibration.csv" pageSize={15} initialSort={{ key: 'id', dir: 'asc' }} />
        </div>
      ),
    },
    {
      id: 'attempts', label: t('m05.tr.tab.attempts'), badge: f.num(attempts.length), content: (
        <div className="space-y-3" data-testid="m05-tr-attempts">
          <p className="text-[13px] text-ink-2">{t('m05.tr.att.intro')}</p>
          {attempts.length ? <DataTable rows={attempts} columns={attCols} rowKey={(a) => a.id} pageSize={15} initialSort={{ key: 'date', dir: 'desc' }} csvName="adaptive-attempts-in-scope.csv" />
            : <EmptyState title={t('m05.tr.att.none')} />}
        </div>
      ),
    },
    {
      id: 'engine', label: t('m05.tr.tab.engine'), content: (
        <Card title={t('m05.tr.eng.title')} actions={<EngineBadge engine={eng} />}>
          <ol className="list-decimal space-y-2 ps-5 text-[13.5px] text-ink-2" data-testid="m05-tr-engine">
            {['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map((k) => <li key={k}>{t(`m05.tr.eng.${k}`)}</li>)}
          </ol>
          <p className="mt-3 text-[12px] text-ink-3">{t('m05.tr.eng.model')}</p>
        </Card>
      ),
    },
  ];
  return (
    <>
      <Tabs tabs={tabs} />
      {edit && <ItemDrawer d={d} item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload?.(); }} />}
    </>
  );
}

function ItemDrawer({ d, item, onClose, onSaved }: { d: FsRef; item: Row; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [v, setV] = useState(() => ({
    bank_id: item.bank_id ?? d.banks[0]?.id ?? '', skill_id: item.skill_id ?? '', facet: item.facet ?? '', difficulty: item.difficulty != null ? String(item.difficulty) : '2.50',
    stem_en: item.stem_en ?? '', stem_ar: item.stem_ar ?? '', options_en: (item.options_en ?? ['', '', '']).join('\n'), options_ar: (item.options_ar ?? ['', '', '']).join('\n'),
    correct: item.correct != null ? String(item.correct) : '0', explain_en: item.explain_en ?? '', explain_ar: item.explain_ar ?? '',
  }));
  const set = (k: keyof typeof v) => (x: string) => setV((cur) => ({ ...cur, [k]: x }));
  const bank = d.banks.find((b: Row) => b.id === v.bank_id);
  const level = useMemo(() => levelOfDifficulty(Number(v.difficulty)), [v.difficulty]);
  const save = async (status: 'active' | 'retired') => {
    const input: AdItemInput = {
      id: item.id ?? null, bank_id: v.bank_id, skill_id: v.skill_id, facet: v.facet.trim(), difficulty: Math.round(Number(v.difficulty) * 100) / 100,
      stem_en: v.stem_en, stem_ar: v.stem_ar, options_en: String(v.options_en).split('\n').map((x: string) => x.trim()).filter(Boolean), options_ar: String(v.options_ar).split('\n').map((x: string) => x.trim()).filter(Boolean),
      correct: Number(v.correct), explain_en: v.explain_en, explain_ar: v.explain_ar, status,
    };
    const r = await act(() => repo.rpc.saveAdaptiveItem(input));
    if (r.ok) onSaved();
  };
  return (
    <Drawer open onClose={onClose} title={item.id ? t('m05.tr.ed.editTitle', { id: item.id }) : t('m05.tr.ed.addTitle')}
      footer={<div className="flex flex-wrap justify-end gap-2">
        {item.id && item.status === 'active' && <button type="button" className="btn-outline btn-sm" onClick={() => save('retired')} data-testid="m05-tr-retire">{t('m05.tr.ed.retire')}</button>}
        <button type="button" className="btn-primary btn-sm" onClick={() => save('active')} data-testid="m05-tr-save">{t('m05.tr.ed.save')}</button>
      </div>}>
      <div className="space-y-3" data-testid="m05-tr-editor">
        <SelectField label={t('m05.tr.items.bank')} name="bank_id" value={v.bank_id} onChange={set('bank_id')} options={d.banks.map((b: Row) => ({ value: b.id, label: pick(b, 'name') }))} />
        <SelectField label={t('m05.tr.ed.skill')} name="skill_id" value={v.skill_id} onChange={set('skill_id')} placeholder={t('m05.tr.ed.pick')}
          options={(bank?.skill_ids ?? []).map((id: string) => { const s = d.skills.find((x: Row) => x.id === id); return { value: id, label: s ? pick(s, 'name') : id }; })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('m05.tr.items.facet')} name="facet" value={v.facet} onChange={set('facet')} hint={t('m05.tr.ed.facetHint')} />
          <TextField label={t('m05.tr.items.difficulty')} name="difficulty" type="number" value={v.difficulty} onChange={set('difficulty')} hint={t('m05.tr.ed.diffHint', { level: f.num(level) })} />
        </div>
        <TextArea label={t('m05.tr.ed.stemEn')} name="stem_en" value={v.stem_en} onChange={set('stem_en')} rows={2} />
        <TextArea label={t('m05.tr.ed.stemAr')} name="stem_ar" value={v.stem_ar} onChange={set('stem_ar')} rows={2} />
        <TextArea label={t('m05.tr.ed.optEn')} name="options_en" value={v.options_en} onChange={set('options_en')} rows={4} hint={t('m05.tr.ed.optHint')} />
        <TextArea label={t('m05.tr.ed.optAr')} name="options_ar" value={v.options_ar} onChange={set('options_ar')} rows={4} />
        <TextField label={t('m05.tr.ed.correct')} name="correct" type="number" value={v.correct} onChange={set('correct')} hint={t('m05.tr.ed.correctHint')} />
        <TextArea label={t('m05.tr.ed.explainEn')} name="explain_en" value={v.explain_en} onChange={set('explain_en')} rows={2} />
        <TextArea label={t('m05.tr.ed.explainAr')} name="explain_ar" value={v.explain_ar} onChange={set('explain_ar')} rows={2} />
        <Callout tone="info" title={t('m05.tr.ed.rulesTitle')}>{t('m05.tr.ed.rules')}</Callout>
      </div>
    </Drawer>
  );
}

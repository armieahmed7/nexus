// FS37 /training/ai-drills (secure_items W/A: training manager, instructors): the sandbox drill bank and its results. Drill statistics
// from rpc.drillStats (latest attempt per person and drill; cells under 10 suppressed): pass rate, average score and the error kinds
// people miss most. Every drill with its key (planted errors, protocol answers); the training manager (ai_literacy W) edits, duplicates and
// publishes drills through rpc.saveDrill (versioned, audited; synthetic SYN- documents only, evidence level 1 or 2, no plant security).
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, BarChart, DataTable, Drawer, ConfirmDialog, TextField, TextArea, SelectField, CheckboxField, StatusPill, Icon, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { ERROR_KINDS, type DrillInput, type DrillStats, type KeyError, type KeyStep } from './drills';
import { Difficulty } from './fs36ui';
import type { Row } from './ui';

function useBank() {
  const repo = useRepo();
  return useQuery(['ai_drills', 'ai_drill_keys', 'ai_drill_attempts'], async () => {
    const [drills, keys, stats] = await Promise.all([
      (repo.list('ai_drills' as never, { order: [['sort', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('ai_drill_keys' as never) as Promise<Row[]>).catch(() => [] as Row[]),
      repo.rpc.drillStats().catch(() => null),
    ]);
    return { drills, keys, stats };
  }, []);
}

export default function TrainingDrillsPage() {
  const t = useT();
  const q = useBank();
  return (
    <Page title={t('m29.routes.training-ai-drills.title')} intro={t('m29.tdr.intro')} wide eyebrow={<BenchmarkChips feature="FS37" />}>
      <Async state={q} isEmpty={() => false}>{(d) => (d.drills.length ? <Body drills={d.drills} keys={d.keys} stats={d.stats} reload={q.reload} /> : <EmptyState title={t('m29.dr.none')} />)}</Async>
    </Page>
  );
}

const toInput = (d: Row, k: Row | undefined, copy = false): DrillInput => ({
  id: copy ? null : d.id, title_en: copy ? `${d.title_en} (copy)` : d.title_en, title_ar: copy ? `${d.title_ar} (نسخة)` : d.title_ar, summary_en: d.summary_en, summary_ar: d.summary_ar,
  scenario_en: d.scenario_en, scenario_ar: d.scenario_ar, difficulty: Number(d.difficulty), level: Number(d.level), skill_id: d.skill_id, est_minutes: Number(d.est_minutes), status: copy ? 'draft' : d.status,
  doc: JSON.parse(JSON.stringify(d.doc)), output: JSON.parse(JSON.stringify(d.output)), protocol: JSON.parse(JSON.stringify(d.protocol)),
  key: { errors: JSON.parse(JSON.stringify(k?.errors ?? [])), protocol: JSON.parse(JSON.stringify(k?.protocol ?? [])), pass_pct: Number(k?.pass_pct ?? 70) },
});

function Body({ drills, keys, stats, reload }: { drills: Row[]; keys: Row[]; stats: DrillStats | null; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const s = useSession();
  const canEdit = s.can('ai_literacy', ['W']) && s.can('secure_items', ['W', 'A']);
  const [edit, setEdit] = useState<DrillInput | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const sup = t('common.suppressedShort');
  const cols: Column<Row>[] = [
    { key: 'title', header: t('m29.tdr.col.drill'), value: (d) => pick(d, 'title'), render: (d) => <span className="flex flex-col"><span className="font-semibold">{pick(d, 'title')}</span><span className="font-mono text-[11.5px] text-ink-3">{d.doc?.code} · v{d.version}</span></span>, sortable: true },
    { key: 'status', header: t('m29.tdr.col.status'), value: (d) => d.status, render: (d) => <StatusPill status={d.status} /> },
    { key: 'diff', header: t('m29.tdr.col.diff'), value: (d) => Number(d.difficulty), render: (d) => <Difficulty n={Number(d.difficulty)} /> },
    { key: 'level', header: t('m29.tdr.col.level'), value: (d) => Number(d.level), render: (d) => t('m29.dr.levelN', { n: f.num(Number(d.level)) }) },
    { key: 'people', header: t('m29.tdr.col.people'), value: (d) => stats?.drills.find((x) => x.drill_id === d.id)?.people ?? -1, render: (d) => { const x = stats?.drills.find((y) => y.drill_id === d.id); return x?.people == null ? <span className="text-ink-3">{sup}</span> : f.num(x.people); }, align: 'end' },
    { key: 'pass', header: t('m29.tdr.col.pass'), value: (d) => stats?.drills.find((x) => x.drill_id === d.id)?.pass_pct ?? -1, render: (d) => { const x = stats?.drills.find((y) => y.drill_id === d.id); return x?.pass_pct == null ? <span className="text-ink-3">{sup}</span> : f.pct(x.pass_pct); }, align: 'end' },
    { key: 'avg', header: t('m29.tdr.col.avg'), value: (d) => stats?.drills.find((x) => x.drill_id === d.id)?.avg_pct ?? -1, render: (d) => { const x = stats?.drills.find((y) => y.drill_id === d.id); return x?.avg_pct == null ? <span className="text-ink-3">{sup}</span> : f.pct(x.avg_pct); }, align: 'end' },
    { key: 'act', header: '', value: () => '', render: (d) => (
      <span className="flex flex-wrap gap-1">
        <button type="button" className="btn-ghost btn-sm" data-testid="m29-tdr-key" onClick={() => setOpen(open === d.id ? null : d.id)}>{t('m29.tdr.key')}</button>
        {canEdit && <button type="button" className="btn-ghost btn-sm" data-testid="m29-tdr-edit" onClick={() => setEdit(toInput(d, keys.find((k) => k.drill_id === d.id)))}>{t('m29.tdr.edit')}</button>}
        {canEdit && <button type="button" className="btn-ghost btn-sm" data-testid="m29-tdr-copy" onClick={() => setEdit(toInput(d, keys.find((k) => k.drill_id === d.id), true))}>{t('m29.tdr.copy')}</button>}
      </span>) },
  ];
  const keyFor = open ? keys.find((k) => k.drill_id === open) : null;
  const drillOpen = open ? drills.find((d) => d.id === open) : null;
  return (
    <div className="space-y-6">
      <Callout tone="sim" title={t('m29.dr.synthetic.title')}>{t('m29.tdr.rules')}</Callout>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m29-tdr-tiles">
        <StatTile label={t('m29.tdr.tile.drills')} value={f.num(drills.filter((d) => d.status === 'published').length)} sub={t('m29.tdr.tile.drillsSub', { n: f.num(drills.filter((d) => d.status === 'draft').length) })} />
        <StatTile label={t('m29.tdr.tile.attempts')} value={stats ? f.num(stats.attempts) : '—'} />
        <StatTile label={t('m29.tdr.tile.people')} value={stats ? (stats.people == null ? sup : f.num(stats.people)) : '—'} />
        <StatTile label={t('m29.tdr.tile.missed')} value={(() => { const m = (stats?.missed_kinds ?? []).filter((k) => k.pct_missed != null).sort((a, b) => (b.pct_missed ?? 0) - (a.pct_missed ?? 0))[0]; return m ? t(`m29.dr.kind.${m.kind}`) : '—'; })()} sub={t('m29.tdr.tile.missedSub')} tone="sim" />
      </div>
      <Section title={t('m29.tdr.bank')} description={t('m29.tdr.bankIntro')}>
        <div data-testid="m29-tdr-table"><DataTable rows={drills} columns={cols} rowKey={(d) => d.id} searchable={false} caption={t('m29.tdr.bank')} csvName="ai-drills.csv" /></div>
      </Section>
      {keyFor && drillOpen && (
        <Card title={t('m29.tdr.keyTitle', { title: pick(drillOpen, 'title') })} actions={<button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(null)}>{t('common.close')}</button>}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="m29-tdr-keyview">
            <ul className="space-y-1.5 text-[13px]">
              {(keyFor.errors as KeyError[]).map((e) => <li key={e.segment_id}><span className="font-mono text-ink-3">{e.segment_id}</span> · <span className="font-semibold">{t(`m29.dr.kind.${e.kind}`)}</span> — {pick(e as unknown as Row, 'explain')}</li>)}
            </ul>
            <ul className="space-y-1.5 text-[13px]">
              {(keyFor.protocol as KeyStep[]).map((k) => { const p = (drillOpen.protocol ?? []).find((x: Row) => x.id === k.id); const o = p?.options?.[k.correct]; return <li key={k.id}><span className="font-semibold">{p ? pick(p, 'q') : k.id}</span> → {o ? (lang === 'ar' ? o.ar : o.en) : k.correct} {k.critical && <StatusPill tone="accent">{t('m29.drill.res.criticalChip')}</StatusPill>}</li>; })}
              <li className="text-ink-3">{t('m29.tdr.passMark', { pct: f.pct(Number(keyFor.pass_pct), 0) })}</li>
            </ul>
          </div>
        </Card>
      )}
      <Card title={t('m29.tdr.missed.title')} eyebrow={t('m29.tdr.missed.eyebrow')}>
        <div data-testid="m29-tdr-missed">
          <BarChart title={t('m29.tdr.missed.title')} unit="%" max={100} data={(stats?.missed_kinds ?? []).map((k) => ({ label: t(`m29.dr.kind.${k.kind}`), value: k.pct_missed, suppressed: k.pct_missed == null, tone: 'info' }))} />
        </div>
      </Card>
      {edit && <Editor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload?.(); }} />}
    </div>
  );
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
function Editor({ init, onClose, onSaved }: { init: DrillInput; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const [v, setV] = useState<DrillInput>(init);
  const [steps, setSteps] = useState(init.doc.steps.map((x) => `${x.text_en} || ${x.text_ar}`).join('\n'));
  const [segs, setSegs] = useState(init.output.segments.map((x) => `${x.id} || ${x.text_en} || ${x.text_ar}`).join('\n'));
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof DrillInput>(k: K, x: DrillInput[K]) => setV((o) => ({ ...o, [k]: x }));
  const build = (): DrillInput => ({
    ...v,
    doc: { ...v.doc, steps: lines(steps).map((l, i) => { const [en, ar] = l.split('||').map((x) => x.trim()); return { n: i + 1, text_en: en ?? '', text_ar: ar ?? '' }; }) },
    output: { ...v.output, segments: lines(segs).map((l) => { const [id, en, ar] = l.split('||').map((x) => x.trim()); return { id: id ?? '', text_en: en ?? '', text_ar: ar ?? '' }; }) },
  });
  const segIds = lines(segs).map((l) => l.split('||')[0].trim());
  const setErr = (i: number, patch: Partial<KeyError>) => set('key', { ...v.key, errors: v.key.errors.map((e, k) => (k === i ? { ...e, ...patch } : e)) });
  const setKs = (i: number, patch: Partial<KeyStep>) => set('key', { ...v.key, protocol: v.key.protocol.map((e, k) => (k === i ? { ...e, ...patch } : e)) });
  return (
    <Drawer open onClose={onClose} title={init.id ? t('m29.tdr.editTitle') : t('m29.tdr.addTitle')}
      footer={<><button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" data-testid="m29-tdr-save" onClick={() => setConfirm(true)}>{t('m29.tdr.save')}</button></>}>
      <div className="space-y-3" data-testid="m29-tdr-editor">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TextField label={t('m29.tdr.f.title_en')} name="title_en" value={v.title_en} onChange={(x) => set('title_en', x)} />
          <TextField label={t('m29.tdr.f.title_ar')} name="title_ar" value={v.title_ar} onChange={(x) => set('title_ar', x)} />
          <TextField label={t('m29.tdr.f.summary_en')} name="summary_en" value={v.summary_en} onChange={(x) => set('summary_en', x)} />
          <TextField label={t('m29.tdr.f.summary_ar')} name="summary_ar" value={v.summary_ar} onChange={(x) => set('summary_ar', x)} />
        </div>
        <TextArea label={t('m29.tdr.f.scenario_en')} name="scenario_en" rows={3} value={v.scenario_en} onChange={(x) => set('scenario_en', x)} />
        <TextArea label={t('m29.tdr.f.scenario_ar')} name="scenario_ar" rows={3} value={v.scenario_ar} onChange={(x) => set('scenario_ar', x)} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SelectField label={t('m29.tdr.f.difficulty')} name="difficulty" value={String(v.difficulty)} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} onChange={(x) => set('difficulty', Number(x))} />
          <SelectField label={t('m29.tdr.f.level')} name="level" value={String(v.level)} options={[1, 2].map((n) => ({ value: String(n), label: t('m29.dr.levelN', { n }) }))} onChange={(x) => set('level', Number(x))} hint={t('m29.tdr.f.levelHint')} />
          <TextField label={t('m29.tdr.f.minutes')} name="est_minutes" type="number" value={String(v.est_minutes)} onChange={(x) => set('est_minutes', Number(x))} />
          <SelectField label={t('m29.tdr.f.status')} name="status" value={v.status} options={['draft', 'published', 'retired'].map((x) => ({ value: x, label: t(`common.status.${x}`) }))} onChange={(x) => set('status', x)} />
        </div>
        <fieldset className="space-y-2 rounded-card border border-line p-3">
          <legend className="caps px-1">{t('m29.tdr.f.doc')}</legend>
          <div className="grid grid-cols-2 gap-2">
            <TextField label={t('m29.tdr.f.code')} name="code" value={v.doc.code} onChange={(x) => set('doc', { ...v.doc, code: x })} hint={t('m29.tdr.f.codeHint')} />
            <TextField label={t('m29.tdr.f.revision')} name="revision" value={v.doc.revision} onChange={(x) => set('doc', { ...v.doc, revision: x })} />
            <TextField label={t('m29.tdr.f.docTitle_en')} name="doc_en" value={v.doc.title_en} onChange={(x) => set('doc', { ...v.doc, title_en: x })} />
            <TextField label={t('m29.tdr.f.docTitle_ar')} name="doc_ar" value={v.doc.title_ar} onChange={(x) => set('doc', { ...v.doc, title_ar: x })} />
          </div>
          <TextArea label={t('m29.tdr.f.steps')} name="steps" rows={6} value={steps} onChange={setSteps} hint={t('m29.tdr.f.stepsHint')} />
        </fieldset>
        <fieldset className="space-y-2 rounded-card border border-line p-3">
          <legend className="caps px-1">{t('m29.tdr.f.output')}</legend>
          <TextArea label={t('m29.tdr.f.segments')} name="segments" rows={6} value={segs} onChange={setSegs} hint={t('m29.tdr.f.segmentsHint')} />
          <h4 className="caps">{t('m29.tdr.f.errors')}</h4>
          {v.key.errors.map((e, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-line p-2 sm:grid-cols-2" data-testid="m29-tdr-error">
              <SelectField label={t('m29.tdr.f.segment')} name={`e${i}s`} value={e.segment_id} options={segIds.map((x) => ({ value: x, label: x }))} onChange={(x) => setErr(i, { segment_id: x })} />
              <SelectField label={t('m29.tdr.f.kind')} name={`e${i}k`} value={e.kind} options={ERROR_KINDS.map((k) => ({ value: k, label: t(`m29.dr.kind.${k}`) }))} onChange={(x) => setErr(i, { kind: x })} />
              <TextField label={t('m29.tdr.f.explain_en')} name={`e${i}en`} value={e.explain_en} onChange={(x) => setErr(i, { explain_en: x })} />
              <TextField label={t('m29.tdr.f.explain_ar')} name={`e${i}ar`} value={e.explain_ar} onChange={(x) => setErr(i, { explain_ar: x })} />
              {v.key.errors.length > 2 && <button type="button" className="btn-ghost btn-sm" onClick={() => set('key', { ...v.key, errors: v.key.errors.filter((_, k) => k !== i) })}>{t('m29.tdr.removeError')}</button>}
            </div>
          ))}
          {v.key.errors.length < 5 && <button type="button" className="btn-outline btn-sm" onClick={() => set('key', { ...v.key, errors: [...v.key.errors, { segment_id: segIds[0] ?? '', kind: 'invented', step_n: null, explain_en: '', explain_ar: '' }] })}><Icon name="plus" size={14} /> {t('m29.tdr.addError')}</button>}
        </fieldset>
        <fieldset className="space-y-2 rounded-card border border-line p-3">
          <legend className="caps px-1">{t('m29.tdr.f.protocol')}</legend>
          {v.protocol.map((p, i) => {
            const ks = v.key.protocol[i];
            return (
              <div key={p.id} className="space-y-1 rounded-md border border-line p-2 text-[13px]">
                <p className="font-semibold">{p.q_en}</p>
                {ks && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <SelectField label={t('m29.tdr.f.correct')} name={`p${i}c`} value={String(ks.correct)} options={p.options.map((o, k) => ({ value: String(k), label: o.en }))} onChange={(x) => setKs(i, { correct: Number(x) })} />
                  <CheckboxField label={t('m29.tdr.f.critical')} checked={ks.critical} onChange={(x) => setKs(i, { critical: x })} />
                </div>}
              </div>
            );
          })}
          <TextField label={t('m29.tdr.f.pass')} name="pass_pct" type="number" value={String(v.key.pass_pct)} onChange={(x) => set('key', { ...v.key, pass_pct: Number(x) })} />
        </fieldset>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m29.tdr.confirm.title')} consequence={t('m29.tdr.confirm.body')}
        onConfirm={async () => { const r = await act(() => repo.rpc.saveDrill(build())); setConfirm(false); if (r.ok) onSaved(); }} />
    </Drawer>
  );
}

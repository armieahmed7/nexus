// FS40 /training/twin-drills (secure_items W/A: instructors, the training manager): the digital-twin drill bank and its results. Drill
// statistics from rpc.twinStats (latest attempt per person and drill; cells under 10 suppressed): pass rate, average score and how often
// people name the wrong component. Every drill with its key when readable; the training manager (secure_items A) edits, duplicates and
// publishes drills through rpc.saveTwinScenario (versioned, audited; synthetic SYN-TW codes only, evidence level 1 or 2, no plant
// security wording). The editor runs the same check as the server (twinProblem) before saving.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, BenchmarkChips, DataTable, Drawer, ConfirmDialog, TextField, TextArea, SelectField, CheckboxField, StatusPill, SimChip, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { TWIN_SKILLS, TWIN_STATUSES, twinProblem, type TwinInput } from './twin';
import { Dots } from './TwinDrillsPage';
import type { Row } from './ui';

function useBank() {
  const repo = useRepo();
  return useQuery(['twin_scenarios', 'twin_keys', 'twin_attempts'], async () => {
    const [scenarios, keys, stats, skills] = await Promise.all([
      (repo.list('twin_scenarios', { order: [['sort', 'asc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      (repo.list('twin_keys') as Promise<Row[]>).catch(() => [] as Row[]),
      repo.rpc.twinStats().catch(() => null),
      (repo.list('skills') as Promise<Row[]>).catch(() => [] as Row[]),
    ]);
    return { scenarios, keys, stats, skills: new Map(skills.map((x) => [x.id as string, x])) };
  }, []);
}

export default function TrainingTwinDrillsPage() {
  const t = useT();
  const q = useBank();
  return (
    <Page title={t('m31.routes.training-twin-drills.title')} intro={t('m31.ttw.intro')} wide eyebrow={<span className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><SimChip /><BenchmarkChips feature="FS40" /></span>}>
      <Async state={q}>{(d) => (d.scenarios.length ? <Body d={d} /> : <EmptyState title={t('m31.tw.none')} />)}</Async>
    </Page>
  );
}

const STRUCT = ['series', 'components', 'modes', 'checks', 'actions', 'rationales'] as const;
const toInput = (sc: Row, k: Row | undefined, copy = false): TwinInput => ({
  id: copy ? null : sc.id, code: copy ? '' : sc.code, title_en: copy ? `${sc.title_en} (copy)` : sc.title_en, title_ar: copy ? `${sc.title_ar} (نسخة)` : sc.title_ar,
  summary_en: sc.summary_en, summary_ar: sc.summary_ar, scenario_en: sc.scenario_en, scenario_ar: sc.scenario_ar, system_en: sc.system_en, system_ar: sc.system_ar,
  difficulty: Number(sc.difficulty), level: Number(sc.level), skill_ids: [...(sc.skill_ids ?? [])], series: JSON.parse(JSON.stringify(sc.series)), components: JSON.parse(JSON.stringify(sc.components)),
  modes: JSON.parse(JSON.stringify(sc.modes)), checks: JSON.parse(JSON.stringify(sc.checks)), actions: JSON.parse(JSON.stringify(sc.actions)), rationales: JSON.parse(JSON.stringify(sc.rationales)),
  max_checks: Number(sc.max_checks), est_minutes: Number(sc.est_minutes), status: copy ? 'draft' : sc.status,
  key: {
    component_id: k?.component_id ?? '', mode_id: k?.mode_id ?? '', useful_checks: [...(k?.useful_checks ?? [])], unsafe_checks: [...(k?.unsafe_checks ?? [])], conservative_actions: [...(k?.conservative_actions ?? [])],
    best_action: k?.best_action ?? '', unsafe_actions: [...(k?.unsafe_actions ?? [])], sound_rationales: [...(k?.sound_rationales ?? [])], explain: JSON.parse(JSON.stringify(k?.explain ?? {})), pass_pct: Number(k?.pass_pct ?? 70),
  },
});

function Body({ d }: { d: { scenarios: Row[]; keys: Row[]; stats: Awaited<ReturnType<ReturnType<typeof useRepo>['rpc']['twinStats']>>; skills: Map<string, Row> } }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const canEdit = s.can('secure_items', ['A']);
  const [edit, setEdit] = useState<TwinInput | null>(null);
  const byId = new Map(d.scenarios.map((x) => [x.id as string, x]));
  const keyOf = (id: string) => d.keys.find((k) => k.scenario_id === id);
  return (
    <div className="space-y-6" data-testid="m31-ttw">
      <Callout tone="sim" title={t('m31.ttw.ruleTitle')}>{t('m31.ttw.ruleBody')}</Callout>
      <Section title={t('m31.ttw.statsTitle')} description={t('m31.ttw.statsDesc', { min: f.num(MIN_GROUP_SIZE) })}>
        {!d.stats ? <EmptyState title={t('m31.ttw.noStats')} /> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m31-ttw-tiles">
              <StatTile label={t('m31.ttw.tile.attempts')} value={f.num(d.stats.attempts)} />
              <StatTile label={t('m31.ttw.tile.people')} value={d.stats.people == null ? t('m31.wf.suppressed') : f.num(d.stats.people)} />
              <StatTile label={t('m31.ttw.tile.drills')} value={f.num(d.scenarios.filter((x) => x.status === 'published').length)} sub={t('m31.ttw.tile.drillsSub', { n: f.num(d.scenarios.filter((x) => x.status === 'draft').length) })} />
              <StatTile label={t('m31.ttw.tile.cap')} value={t('m31.tw.levelN', { n: f.num(2) })} />
            </div>
            <DataTable rows={d.stats.scenarios} rowKey={(r) => r.scenario_id} searchable={false} csvName="twin-drill-stats"
              columns={[
                { key: 'drill', header: t('m31.ttw.col.drill'), value: (r) => (byId.get(r.scenario_id) ? pick(byId.get(r.scenario_id), 'title') : r.scenario_id) },
                { key: 'people', header: t('m31.ttw.col.people'), value: (r) => r.people, render: (r) => (r.people == null ? <span className="text-ink-3">{t('m31.ttw.suppressed')}</span> : f.num(r.people)), align: 'end' },
                { key: 'pass', header: t('m31.ttw.col.pass'), value: (r) => r.pass_pct, render: (r) => f.pct(r.pass_pct, 1), align: 'end' },
                { key: 'avg', header: t('m31.ttw.col.avg'), value: (r) => r.avg_pct, render: (r) => f.pct(r.avg_pct, 1), align: 'end' },
                { key: 'mis', header: t('m31.ttw.col.mis'), value: (r) => r.misdiagnosed_pct, render: (r) => f.pct(r.misdiagnosed_pct, 1), align: 'end' },
              ]} />
          </div>
        )}
      </Section>
      <Section title={t('m31.ttw.bankTitle')} description={canEdit ? t('m31.ttw.bankDescEdit') : t('m31.ttw.bankDesc')}>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m31-ttw-bank">
          {d.scenarios.map((x) => {
            const k = keyOf(x.id);
            return (
              <li key={x.id} data-id={x.id} data-status={x.status}>
                <Card title={<span className="flex flex-wrap items-center gap-2">{pick(x, 'title')} <StatusPill tone={x.status === 'published' ? 'ok' : x.status === 'draft' ? 'sim' : 'neutral'}>{t(`m31.adm.st.${x.status}`)}</StatusPill></span>}
                  eyebrow={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{x.code}</span> · <Dots n={Number(x.difficulty)} /> · {t('m31.tw.upTo', { n: f.num(Number(x.level)) })} · {t('m31.ttw.version', { v: f.num(x.version) })}</span>}
                  actions={canEdit && <span className="flex gap-1">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(toInput(x, k))} data-testid="m31-ttw-edit">{t('m31.ttw.edit')}</button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(toInput(x, k, true))} data-testid="m31-ttw-copy">{t('m31.ttw.copy')}</button>
                  </span>}>
                  <p className="text-[13px] text-ink-2">{pick(x, 'summary')}</p>
                  <ul className="mt-2 flex flex-wrap gap-1">{(x.skill_ids as string[]).map((id) => <li key={id} className="chip border-line bg-sunken normal-case tracking-normal text-ink-2">{d.skills.get(id) ? pick(d.skills.get(id), 'name') : id}</li>)}</ul>
                  {k ? <KeyView sc={x} k={k} /> : <p className="mt-2 text-[12px] text-ink-3">{t('m31.ttw.keyHidden')}</p>}
                </Card>
              </li>
            );
          })}
        </ul>
      </Section>
      {edit && <Editor init={edit} onClose={() => setEdit(null)} skills={d.skills} />}
    </div>
  );
}

function KeyView({ sc, k }: { sc: Row; k: Row }) {
  const t = useT();
  const lang = useLang();
  const name = (list: string, id: string) => { const o = ((sc[list] ?? []) as Row[]).find((x) => x.id === id); return o ? (lang === 'ar' ? o.ar : o.en) : id; };
  return (
    <details className="mt-3 rounded-md border border-line p-2 text-[12.5px]" data-testid="m31-ttw-key">
      <summary className="cursor-pointer font-semibold">{t('m31.ttw.key')}</summary>
      <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-3">
        <dt className="text-ink-3">{t('m31.twd.res.component')}</dt><dd>{name('components', k.component_id)} · {name('modes', k.mode_id)}</dd>
        <dt className="text-ink-3">{t('m31.ttw.useful')}</dt><dd>{(k.useful_checks as string[]).map((c) => name('checks', c)).join(' · ')}</dd>
        <dt className="text-ink-3">{t('m31.ttw.unsafeChecks')}</dt><dd>{(k.unsafe_checks as string[]).map((c) => name('checks', c)).join(' · ') || '—'}</dd>
        <dt className="text-ink-3">{t('m31.ttw.bestAction')}</dt><dd>{name('actions', k.best_action)}</dd>
        <dt className="text-ink-3">{t('m31.ttw.unsafeActions')}</dt><dd>{(k.unsafe_actions as string[]).map((c) => name('actions', c)).join(' · ') || '—'}</dd>
        <dt className="text-ink-3">{t('m31.ttw.passMark')}</dt><dd>{k.pass_pct}%</dd>
      </dl>
    </details>
  );
}

function Editor({ init, onClose, skills }: { init: TwinInput; onClose: () => void; skills: Map<string, Row> }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [v, setV] = useState<TwinInput>(init);
  const [json, setJson] = useState(() => JSON.stringify({ ...Object.fromEntries(STRUCT.map((k) => [k, init[k]])), key: init.key }, null, 2));
  const [confirm, setConfirm] = useState(false);
  const parsed = useMemo(() => { try { return { ok: true as const, x: JSON.parse(json) as Row }; } catch { return { ok: false as const, x: null }; } }, [json]);
  const input: TwinInput | null = parsed.ok ? { ...v, ...Object.fromEntries(STRUCT.map((k) => [k, parsed.x![k]])), key: parsed.x!.key } as TwinInput : null;
  const problem = input ? twinProblem(input, TWIN_SKILLS) : 'json';
  const set = <K extends keyof TwinInput>(k: K, x: TwinInput[K]) => setV({ ...v, [k]: x });
  const save = async () => { if (!input) return; const r = await act(() => repo.rpc.saveTwinScenario(input)); setConfirm(false); if (r.ok) onClose(); };
  return (
    <Drawer open onClose={onClose} title={v.id ? t('m31.ttw.editTitle', { code: init.code }) : t('m31.ttw.newTitle')}
      footer={<div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[12.5px] ${problem ? 'text-bad' : 'text-ok'}`} role="status" data-testid="m31-ttw-check" data-problem={problem ?? ''}>{problem ? t(`m31.ttw.problem.${problem}`) : t('m31.adm.ready')}</span>
        <div className="flex gap-2"><button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button type="button" className="btn-primary" disabled={!!problem} onClick={() => setConfirm(true)} data-testid="m31-ttw-save">{t('m31.adm.save')}</button></div>
      </div>}>
      <div className="space-y-3" data-testid="m31-ttw-editor">
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('m31.ttw.code')} name="code" value={v.code} onChange={(x) => set('code', x)} hint={t('m31.ttw.codeHint')} />
          <SelectField label={t('m31.adm.status')} name="status" value={v.status} onChange={(x) => set('status', x)} options={TWIN_STATUSES.map((x) => ({ value: x, label: t(`m31.adm.st.${x}`) }))} />
        </div>
        <TextField label={t('m31.ttw.titleEn')} name="title_en" value={v.title_en} onChange={(x) => set('title_en', x)} />
        <TextField label={t('m31.ttw.titleAr')} name="title_ar" value={v.title_ar} onChange={(x) => set('title_ar', x)} />
        <TextArea label={t('m31.ttw.summaryEn')} name="summary_en" rows={2} value={v.summary_en} onChange={(x) => set('summary_en', x)} />
        <TextArea label={t('m31.ttw.summaryAr')} name="summary_ar" rows={2} value={v.summary_ar} onChange={(x) => set('summary_ar', x)} />
        <TextArea label={t('m31.ttw.scenarioEn')} name="scenario_en" rows={3} value={v.scenario_en} onChange={(x) => set('scenario_en', x)} />
        <TextArea label={t('m31.ttw.scenarioAr')} name="scenario_ar" rows={3} value={v.scenario_ar} onChange={(x) => set('scenario_ar', x)} />
        <TextField label={t('m31.ttw.systemEn')} name="system_en" value={v.system_en} onChange={(x) => set('system_en', x)} />
        <TextField label={t('m31.ttw.systemAr')} name="system_ar" value={v.system_ar} onChange={(x) => set('system_ar', x)} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField label={t('m31.ttw.difficulty')} name="difficulty" value={String(v.difficulty)} onChange={(x) => set('difficulty', Number(x))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
          <SelectField label={t('m31.ttw.level')} name="level" value={String(v.level)} onChange={(x) => set('level', Number(x))} options={[1, 2].map((n) => ({ value: String(n), label: String(n) }))} />
          <TextField label={t('m31.ttw.minutes')} name="est_minutes" type="number" value={String(v.est_minutes)} onChange={(x) => set('est_minutes', Number(x))} />
          <TextField label={t('m31.ttw.maxChecks')} name="max_checks" type="number" value={String(v.max_checks)} onChange={(x) => set('max_checks', Number(x))} />
        </div>
        <fieldset className="space-y-1">
          <legend className="text-[13px] font-semibold">{t('m31.ttw.skills')}</legend>
          {TWIN_SKILLS.map((id) => <CheckboxField key={id} label={skills.get(id) ? pick(skills.get(id), 'name') : id} checked={v.skill_ids.includes(id)} onChange={(c) => set('skill_ids', c ? [...v.skill_ids, id] : v.skill_ids.filter((x) => x !== id))} />)}
        </fieldset>
        <TextArea label={t('m31.ttw.structure')} name="structure" rows={16} value={json} onChange={setJson} hint={t('m31.ttw.structureHint')} />
        {!parsed.ok && <p className="text-[12.5px] text-bad" role="alert"><Icon name="alert" size={12} /> {t('m31.ttw.jsonError')}</p>}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m31.ttw.confirmTitle')} onConfirm={save}
        consequence={v.status === 'published' ? t('m31.ttw.confirmPublish') : t('m31.ttw.confirmDraft')} />
    </Drawer>
  );
}

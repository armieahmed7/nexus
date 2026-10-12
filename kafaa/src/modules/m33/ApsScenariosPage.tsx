// FS58 /training/aps/scenarios (secure_items W/A: instructors read, the training manager writes): the adaptive problem-solving scenario
// bank. Each scenario's stages in order (the plan, then every mid-task change), every option's effectiveness and why, which facts matter
// and the expert debrief, in English and Arabic. Coverage by theme and how many changes each scenario carries. The training manager adds,
// edits, publishes or retires scenarios through rpc.saveApsScenario: the server re-checks every rule (at least one mid-task change, 2-4
// stages, 3-4 options with one best, facts with at least one that matters, both languages, no plant-security wording) and the database
// refuses a scenario without a change (check kafaa_aps_scenarios_change_ck). Every save is audited.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, BenchmarkChips, BarChart, DataTable, Drawer, ConfirmDialog, StatusPill, FilterBar, useFilters, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { APS_THEMES, apsScenarioProblem, changeCount, type ApsScenarioInput, type ApsStage } from './aps';
import { ScaleCard, ScenarioEditor } from './fs65ui';
import { useCoreName, useM33Ref, type M33Ref, type Row } from './ui';

function useBank() {
  const repo = useRepo();
  return useQuery(['aps_scenarios'], async () => (await repo.list('aps_scenarios' as never, { order: [['sort', 'asc']] } as never)) as Row[], []);
}

export default function ApsScenariosPage() {
  const t = useT();
  const ref = useM33Ref();
  const q = useBank();
  return (
    <Page title={t('m33.routes.training-aps-scenarios.title')} intro={t('m33.aps.bank.intro')} wide eyebrow={<BenchmarkChips feature="FS58" />}>
      <Async state={ref}>{(d) => <Async state={q} isEmpty={() => false}>{(rows) => <Bank d={d} rows={rows} reload={q.reload} />}</Async>}</Async>
    </Page>
  );
}

const EFF_TEXT = ['text-bad', 'text-sim', 'text-info', 'text-ok'];
const EDIT_KEYS = ['code', 'theme', 'title_en', 'title_ar', 'summary_en', 'summary_ar', 'context_en', 'context_ar', 'core_skill_ids', 'skill_ids', 'difficulty', 'est_minutes', 'stages'] as const;

function Bank({ d, rows, reload }: { d: M33Ref; rows: Row[]; reload?: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const coreName = useCoreName(d);
  const canWrite = s.can('secure_items', ['A']);
  const [open, setOpen] = useState<Row | null>(null);
  const [edit, setEdit] = useState<{ id: string | null; status: string; body: Record<string, unknown> } | null>(null);
  const [status, setStatus] = useState<{ row: Row; to: 'published' | 'retired' } | null>(null);
  const [flt, setFlt] = useFilters({ q: '', theme: '', status: '' }, true);
  const published = rows.filter((r) => r.status === 'published');
  const ctx = useMemo(() => ({ coreSkillIds: d.core.map((c: Row) => c.id), skillIds: d.skills.map((x: Row) => x.id) }), [d]);
  const shown = useMemo(() => rows
    .filter((r) => !flt.theme || r.theme === flt.theme)
    .filter((r) => !flt.status || r.status === flt.status)
    .filter((r) => !flt.q || `${r.code} ${r.title_en} ${r.title_ar}`.toLowerCase().includes(flt.q.toLowerCase())), [rows, flt]);
  const bodyOf = (r: Row) => Object.fromEntries(EDIT_KEYS.map((k) => [k, r[k]]));
  const save = async (id: string | null, st: string, body: Record<string, unknown>) => {
    const r = await act(() => repo.rpc.saveApsScenario({ ...(body as unknown as ApsScenarioInput), id, status: st }));
    if (r.ok) reload?.();
    return r.ok;
  };
  const cols: Column<Row>[] = [
    { key: 'code', header: t('m33.rp.col.code'), value: (r) => r.code, render: (r) => <span className="num text-[12px]">{r.code}</span>, sortable: true },
    { key: 'theme', header: t('m33.aps.bank.theme'), value: (r) => r.theme, render: (r) => t(`m33.aps.theme.${r.theme}`), sortable: true },
    { key: 'title', header: t('m33.rp.col.title'), value: (r) => pick(r, 'title') },
    { key: 'stages', header: t('m33.aps.bank.stages'), align: 'end', value: (r) => (r.stages ?? []).length, render: (r) => <span className="num">{f.num((r.stages ?? []).length)}</span> },
    { key: 'changes', header: t('m33.aps.bank.changes'), align: 'end', value: (r) => changeCount(r), render: (r) => <span className="num" data-testid="m33-aps-bank-changes" data-n={changeCount(r)}>{f.num(changeCount(r))}</span>, sortable: true },
    { key: 'status', header: t('m33.bank.col.status'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'published' ? 'ok' : r.status === 'draft' ? 'info' : 'neutral'}>{t(`m33.rp.status.${r.status}`)}</StatusPill> },
    { key: 'v', header: t('m33.bank.col.version'), align: 'end', value: (r) => r.version, render: (r) => <span className="num">{f.num(r.version)}</span> },
  ];
  const template = published[0] ?? rows[0];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title={t('m33.aps.bank.coverage')} eyebrow={t('m33.aps.bank.coverageEyebrow', { n: f.num(published.length) })}>
          <div data-testid="m33-aps-bank-coverage">
            <BarChart title={t('m33.aps.bank.coverage')} data={APS_THEMES.map((th) => ({ label: t(`m33.aps.theme.${th}`), value: published.filter((r) => r.theme === th).length, tone: published.some((r) => r.theme === th) ? 'ok' : 'neutral' }))} />
          </div>
          <p className="mt-2 text-[12.5px] text-ok" data-testid="m33-aps-bank-allchange">{t('m33.aps.bank.allChange', { n: f.num(rows.filter((r) => changeCount(r) >= 1).length), total: f.num(rows.length) })}</p>
        </Card>
        <Card title={t('m33.aps.bank.rules.title')} eyebrow={t('m33.bank.rules.eyebrow')}>
          <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">{['r1', 'r2', 'r3', 'r4', 'r5'].map((k) => <li key={k}>{t(`m33.aps.bank.rules.${k}`)}</li>)}</ul>
          {canWrite ? (template && <button type="button" className="btn-primary mt-4" onClick={() => setEdit({ id: null, status: 'draft', body: { ...bodyOf(template), code: 'APS-XX-001' } })} data-testid="m33-aps-bank-add">{t('m33.aps.bank.add')}</button>)
            : <p className="mt-3 text-[12.5px] text-ink-3" data-testid="m33-aps-bank-readonly">{t('m33.bank.readonly')}</p>}
        </Card>
      </div>
      <Section title={t('m33.aps.bank.list', { n: f.num(rows.length) })}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'theme', label: t('m33.aps.bank.theme'), options: APS_THEMES.map((x) => ({ value: x, label: t(`m33.aps.theme.${x}`) })) },
          { key: 'status', label: t('m33.bank.col.status'), options: ['draft', 'published', 'retired'].map((x) => ({ value: x, label: t(`m33.rp.status.${x}`) })) },
        ]} />
        {shown.length ? <div data-testid="m33-aps-bank-list"><DataTable rows={shown} columns={cols} rowKey={(r) => r.id} onRowClick={(r) => setOpen(r)} searchable={false} pageSize={12} caption={t('m33.aps.bank.caption')} /></div>
          : <EmptyState title={t('m33.aps.bank.none')} />}
      </Section>
      <Card title={t('m33.aps.scale.title')} eyebrow={t('m33.aps.scale.eyebrow')}><ScaleCard /></Card>
      <Callout tone="sim" title={t('m33.bank.security.title')}>{t('m33.aps.bank.security')}</Callout>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${open.code} · ${pick(open, 'title')}` : ''}
        footer={open && canWrite ? <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => { setEdit({ id: open.id, status: open.status, body: bodyOf(open) }); setOpen(null); }} data-testid="m33-aps-bank-edit">{t('m33.bank.edit')}</button>
          {open.status !== 'published' && <button type="button" className="btn-outline btn-sm" onClick={() => { setStatus({ row: open, to: 'published' }); setOpen(null); }} data-testid="m33-aps-bank-publish">{t('m33.rp.tr.publish')}</button>}
          {open.status === 'published' && <button type="button" className="btn-outline btn-sm" onClick={() => { setStatus({ row: open, to: 'retired' }); setOpen(null); }} data-testid="m33-aps-bank-retire">{t('m33.bank.retire')}</button>}
        </div> : undefined}>
        {open && (
          <div className="space-y-5 text-[13.5px]" data-testid="m33-aps-bank-drawer">
            <div className="flex flex-wrap gap-1">{(open.core_skill_ids ?? []).map((id: string) => <span key={id} className="chip border-line bg-panel normal-case tracking-normal text-ink-2">{coreName(id)}</span>)}</div>
            {(['en', 'ar'] as const).map((lng) => (
              <div key={lng} dir={lng === 'ar' ? 'rtl' : 'ltr'} lang={lng} className="space-y-3">
                <h3 className="caps">{t(`m33.bank.lang.${lng}`)}</h3>
                <p className="text-ink-2">{open[`context_${lng}`]}</p>
                {(open.stages as ApsStage[]).map((st, si) => (
                  <div key={st.id} className={`rounded-card border p-2.5 ${st.kind === 'change' ? 'border-sim-line bg-sim-bg' : 'border-line'}`} data-kind={st.kind}>
                    <div className="caps mb-1 text-[10.5px]">{si === 0 ? t('m33.aps.stagePlan') : t('m33.aps.stageChange', { n: f.num(si) })}</div>
                    <p>{st[`info_${lng}`]}</p>
                    <p className="mt-1 font-semibold">{st[`question_${lng}`]}</p>
                    {st.cues.length > 0 && <ul className="mt-1 space-y-0.5 text-[12.5px]">{st.cues.map((c, i) => <li key={i}>{c.relevant ? '✓' : '·'} {c[lng]}</li>)}</ul>}
                    <ol className="mt-1.5 space-y-1">
                      {st.options.map((o, i) => (
                        <li key={i} className="rounded-md border border-line bg-panel px-2 py-1.5" data-eff={o.eff}>
                          <div className="flex items-start justify-between gap-2"><span>{o[lng]}</span><span className={`caps shrink-0 text-[10.5px] ${EFF_TEXT[o.eff]}`}>{t(`m33.sjt.eff.${o.eff}`)}{o.keep ? ` · ${t('m33.aps.bank.keep')}` : ''}</span></div>
                          <p className="mt-0.5 text-[12px] text-ink-3">{o[`note_${lng}`]}</p>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-1.5 rounded-md bg-sunken p-2 text-[12.5px] text-ink-2">{st[`debrief_${lng}`]}</p>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-[12px] text-ink-3">{t('m33.bank.meta', { v: f.num(open.version), date: f.date(String(open.updated_at).slice(0, 10)) })}</p>
          </div>
        )}
      </Drawer>
      <ScenarioEditor open={!!edit} onClose={() => setEdit(null)} testId="m33-aps-editor" initial={edit?.body ?? null}
        title={edit?.id ? t('m33.rp.tr.editTitle', { code: String(edit.body.code) }) : t('m33.aps.bank.add')}
        problemOf={(x) => { const p = apsScenarioProblem(x as Partial<ApsScenarioInput>, ctx); return p ? t(`m33.aps.problem.${p}`) : null; }}
        onSave={(x) => save(edit?.id ?? null, edit?.status ?? 'draft', x)} />
      <ConfirmDialog open={!!status} onClose={() => setStatus(null)} title={status ? t(`m33.rp.tr.${status.to}Title`, { code: status.row.code }) : ''} consequence={status ? t(`m33.aps.bank.${status.to}Body`) : ''}
        danger={status?.to === 'retired'} confirmLabel={status?.to === 'retired' ? t('m33.bank.retire') : t('m33.rp.tr.publish')}
        onConfirm={async () => { if (status) await save(status.row.id, status.to, bodyOf(status.row)); setStatus(null); }} />
    </div>
  );
}

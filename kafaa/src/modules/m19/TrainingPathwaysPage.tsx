// FS17 /training/pathways (training manager writes; instructors and auditors read): every pathway with its status, version, envelope,
// weekly hours and how many steps resolve; an editor with the same checks as the server (pathwayProblems = SQL kafaa_pw_problems; a
// published edit bumps the version and keeps the earlier steps); the FS57 gap backlog of requested steps with a refresh; coverage by area.
import { useMemo, useState } from 'react';
import { Page, Section, Async, EmptyState, StatTile, BenchmarkChips, Tabs, DataTable, Drawer, TextField, TextArea, SelectField, CheckboxField, BarChart, StatusPill, Icon, Callout, ConfirmDialog } from '../../ui';
import { useAction, useQuery, useRepo, type Table } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { STEP_KINDS, envelopeWeeks, pathwayProblems, type SkillRef } from './pathways';
import { LevelPill, usePwRef, type PwRef, type Row } from './fsui';
import { FS_AREAS } from './PathwaysPage';

export default function TrainingPathwaysPage() {
  const t = useT();
  const ref = usePwRef();
  return (
    <Page title={t('m19.routes.training-pathways.title')} intro={t('m19.pw.adm.intro')} wide eyebrow={<BenchmarkChips feature="FS17" />}
      actions={<L to="/training/external" className="btn-outline btn-sm no-underline"><Icon name="external" size={14} /> {t('m19.pw.adm.toExternal')}</L>}>
      <Async state={ref}>{(d) => <Admin d={d} />}</Async>
    </Page>
  );
}

interface StepDraft { kind: string; title_en: string; title_ar: string; hours: string; pins: string }
interface Draft { id?: string; skill_id: string; level: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; outcome_en: string; outcome_ar: string; envelope_months: string; weekly_hours: string; status: string; steps: StepDraft[] }

function Admin({ d }: { d: PwRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canEdit = s.identity.roles.includes('training_manager');
  const all = useQuery(['pathways', 'pathway_steps', 'pathway_gaps'] as Table[], async () => {
    const [steps, gaps] = await Promise.all([repo.list('pathway_steps' as Table).catch(() => []), repo.list('pathway_gaps' as Table).catch(() => [])]);
    return { steps: steps as Row[], gaps: gaps as Row[] };
  }, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refresh, setRefresh] = useState(false);
  const skills = useMemo(() => new Map(d.skills.map((x) => [x.id, x])), [d.skills]);
  const cat = new Map((d.catalogue?.pathways ?? []).map((p) => [p.id, p]));
  const open = (p: Row | null) => {
    const steps = (all.data?.steps ?? []).filter((x) => p && x.pathway_id === p.id && Number(x.version) === Number(p.version)).sort((a, b) => a.n - b.n);
    setDraft(p ? {
      id: p.id, skill_id: p.skill_id, level: String(p.level), title_en: p.title_en, title_ar: p.title_ar, summary_en: p.summary_en ?? '', summary_ar: p.summary_ar ?? '', outcome_en: p.outcome_en ?? '', outcome_ar: p.outcome_ar ?? '',
      envelope_months: String(p.envelope_months), weekly_hours: String(p.weekly_hours), status: p.status, steps: steps.map((x) => ({ kind: x.kind, title_en: x.title_en, title_ar: x.title_ar, hours: String(x.hours), pins: (x.pins ?? []).join(', ') })),
    } : { skill_id: '', level: '1', title_en: '', title_ar: '', summary_en: '', summary_ar: '', outcome_en: '', outcome_ar: '', envelope_months: '3', weekly_hours: '2', status: 'draft',
      steps: STEP_KINDS.map((k) => ({ kind: k, title_en: '', title_ar: '', hours: k === 'assess' ? '2' : '8', pins: '' })) });
  };
  const gaps = (all.data?.gaps ?? []).filter((g) => g.status === 'open');
  const fsSkills = d.skills.filter((x) => x.fs_area && x.lifecycle !== 'obsolete' && x.area !== 'security');
  const pub = d.pathways.filter((p) => p.status === 'published');
  const coverage = FS_AREAS.map((a) => {
    const ps = pub.filter((p) => skills.get(p.skill_id)?.fs_area === a);
    const steps = ps.reduce((n, p) => n + (cat.get(p.id)?.steps ?? 0), 0);
    const req = ps.reduce((n, p) => n + (cat.get(p.id)?.requested ?? 0), 0);
    return { a, ps: ps.length, ready: steps ? Math.round((100 * (steps - req)) / steps) : 0 };
  });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m19-adm-tiles">
        <StatTile label={t('m19.pw.adm.tileL1')} value={`${f.num(fsSkills.filter((x) => pub.some((p) => p.skill_id === x.id && Number(p.level) === 1)).length)} / ${f.num(fsSkills.length)}`} sub={t('m19.pw.adm.tileL1Sub')} tone="ok" />
        <StatTile label={t('m19.pw.adm.tilePublished')} value={f.num(pub.length)} sub={t('m19.pw.adm.tileDrafts', { n: f.num(d.pathways.filter((p) => p.status === 'draft').length) })} />
        <StatTile label={t('m19.pw.adm.tileGaps')} value={f.num(gaps.length)} sub={t('m19.pw.adm.tileGapsSub')} tone="sim" />
        <StatTile label={t('m19.pw.adm.tileEnrol')} value={f.num((d.catalogue?.pathways ?? []).reduce((n, p) => n + (p.peer.started ?? 0), 0))} sub={t('m19.pw.adm.tileEnrolSub')} />
      </div>
      {!canEdit && <Callout title={t('m19.pw.adm.readOnly')}>{t('m19.pw.adm.readOnlyBody')}</Callout>}
      <Tabs initial="pathways" tabs={[
        { id: 'pathways', label: t('m19.pw.adm.tabPathways'), badge: d.pathways.length, content: (
          <DataTable rows={d.pathways} rowKey={(p) => p.id} csvName="kafaa-pathways.csv" onRowClick={canEdit ? (p) => open(p) : undefined}
            toolbar={canEdit ? <button type="button" className="btn-primary btn-sm" onClick={() => open(null)} data-testid="m19-adm-new"><Icon name="plus" size={14} />{t('m19.pw.adm.new')}</button> : undefined}
            columns={[
              { key: 'title', header: t('m19.pw.adm.colPathway'), value: (p) => pick(p, 'title'), render: (p) => <span className="flex items-center gap-2"><LevelPill level={Number(p.level)} /><L to={`/learn/pathways/${p.id}`}>{pick(p, 'title')}</L></span> },
              { key: 'area', header: t('m19.pw.cat.fArea'), value: (p) => t(`fs.area.${skills.get(p.skill_id)?.fs_area ?? 'none'}`) },
              { key: 'status', header: t('m19.pw.adm.colStatus'), value: (p) => p.status, render: (p) => <StatusPill tone={p.status === 'published' ? 'ok' : p.status === 'draft' ? 'sim' : 'neutral'}>{t(`m19.pw.status.${p.status}`)}</StatusPill> },
              { key: 'version', header: t('m19.pw.adm.colVersion'), value: (p) => Number(p.version), align: 'end' },
              { key: 'env', header: t('m19.pw.adm.colEnvelope'), value: (p) => Number(p.envelope_months), render: (p) => t('m19.pw.monthsN', { n: f.num(Number(p.envelope_months)) }), align: 'end' },
              { key: 'weekly', header: t('m19.pw.adm.colWeekly'), value: (p) => Number(p.weekly_hours), render: (p) => t('m19.pw.hoursN', { n: f.num(Number(p.weekly_hours)) }), align: 'end' },
              { key: 'ready', header: t('m19.pw.adm.colReady'), value: (p) => (cat.get(p.id) ? cat.get(p.id)!.steps - cat.get(p.id)!.requested : null), render: (p) => cat.get(p.id) ? `${f.num(cat.get(p.id)!.steps - cat.get(p.id)!.requested)} / ${f.num(cat.get(p.id)!.steps)}` : '—', align: 'end' },
            ]} />
        ) },
        { id: 'gaps', label: t('m19.pw.adm.tabGaps'), badge: gaps.length, content: (
          <div className="space-y-3">
            <p className="text-[13.5px] text-ink-2">{t('m19.pw.adm.gapsIntro')}</p>
            <DataTable rows={gaps} rowKey={(g) => g.id} csvName="kafaa-pathway-gaps.csv" empty={<EmptyState icon="check" title={t('m19.pw.adm.gapsEmpty')} />}
              toolbar={canEdit ? <button type="button" className="btn-outline btn-sm" onClick={() => setRefresh(true)} data-testid="m19-adm-refresh"><Icon name="reset" size={14} />{t('m19.pw.adm.refresh')}</button> : undefined}
              columns={[
                { key: 'skill', header: t('m19.pw.adm.colSkill'), value: (g) => pick(skills.get(g.skill_id) ?? {}, 'name'), render: (g) => <L to={`/skills/${g.skill_id}`}>{pick(skills.get(g.skill_id) ?? {}, 'name')}</L> },
                { key: 'level', header: t('m19.pw.cat.fLevel'), value: (g) => Number(g.level), render: (g) => <LevelPill level={Number(g.level)} /> },
                { key: 'kind', header: t('m19.pw.adm.colKind'), value: (g) => t(`m19.pw.kind.${g.kind}`) },
                { key: 'pathway', header: t('m19.pw.adm.colPathway'), value: (g) => g.pathway_id, render: (g) => <L to={`/learn/pathways/${g.pathway_id}`}>{pick(d.pathways.find((p) => p.id === g.pathway_id) ?? {}, 'title')}</L> },
                { key: 'first', header: t('m19.pw.adm.colFirst'), value: (g) => g.first_seen, render: (g) => f.date(g.first_seen) },
              ]} />
            <p className="text-[12.5px] text-ink-3">{t('m19.pw.adm.gapsFoot')}</p>
          </div>
        ) },
        { id: 'coverage', label: t('m19.pw.adm.tabCoverage'), content: (
          <Section title={t('m19.pw.adm.coverageTitle')} description={t('m19.pw.adm.coverageIntro')}>
            <BarChart title={t('m19.pw.adm.coverageTitle')} unit="%" max={100} data={coverage.map((c) => ({ label: t(`fs.area.${c.a}`), value: c.ready }))} />
          </Section>
        ) },
      ]} />
      {draft && <Editor draft={draft} setDraft={setDraft} d={d} onSave={async () => {
        const body = { ...(draft.id ? { id: draft.id } : {}), skill_id: draft.skill_id, level: Number(draft.level), title_en: draft.title_en, title_ar: draft.title_ar, summary_en: draft.summary_en, summary_ar: draft.summary_ar,
          outcome_en: draft.outcome_en, outcome_ar: draft.outcome_ar, envelope_months: Number(draft.envelope_months), weekly_hours: Number(draft.weekly_hours), status: draft.status,
          steps: draft.steps.map((x) => ({ kind: x.kind, title_en: x.title_en, title_ar: x.title_ar, hours: Number(x.hours), pins: x.pins.split(',').map((q) => q.trim()).filter(Boolean) })) };
        const r = await run(() => repo.rpc.savePathway(body), { success: t('m19.pw.adm.saved') });
        if (r.ok) setDraft(null);
      }} />}
      <ConfirmDialog open={refresh} onClose={() => setRefresh(false)} title={t('m19.pw.adm.refreshTitle')} consequence={t('m19.pw.adm.refreshBody')}
        onConfirm={() => run(() => repo.rpc.refreshPathwayGaps())} />
    </div>
  );
}

function Editor({ draft, setDraft, d, onSave }: { draft: Draft; setDraft: (d: Draft | null) => void; d: PwRef; onSave: () => Promise<void> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setStep = (i: number, patch: Partial<StepDraft>) => set({ steps: draft.steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const input = { skill_id: draft.skill_id, level: Number(draft.level), title_en: draft.title_en, title_ar: draft.title_ar, envelope_months: Number(draft.envelope_months), weekly_hours: Number(draft.weekly_hours),
    steps: draft.steps.map((x) => ({ kind: x.kind, title_en: x.title_en, title_ar: x.title_ar, hours: Number(x.hours), pins: x.pins.split(',').map((q) => q.trim()).filter(Boolean) })) };
  const problems = pathwayProblems(input, d.skills as unknown as SkillRef[]);
  const total = draft.steps.reduce((n, x) => n + (Number(x.hours) || 0), 0);
  const cap = envelopeWeeks(Number(draft.envelope_months) || 0) * (Number(draft.weekly_hours) || 0);
  const fsSkills = d.skills.filter((x) => x.fs_area && x.lifecycle !== 'obsolete' && x.area !== 'security');
  return (
    <Drawer open onClose={() => !busy && setDraft(null)} title={draft.id ? t('m19.pw.adm.editTitle') : t('m19.pw.adm.newTitle')}
      footer={<>
        <button type="button" className="btn-outline" onClick={() => setDraft(null)} disabled={busy}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={busy || problems.length > 0} data-testid="m19-adm-save" onClick={async () => { setBusy(true); await onSave(); setBusy(false); }}>{t('m19.pw.adm.save')}</button>
      </>}>
      <div className="space-y-3" data-testid="m19-adm-editor">
        <SelectField label={t('m19.pw.adm.colSkill')} name="skill" value={draft.skill_id} onChange={(v) => set({ skill_id: v })} disabled={!!draft.id} placeholder={t('m19.pw.adm.pickSkill')}
          options={fsSkills.map((x) => ({ value: x.id, label: pick(x, 'name') }))} />
        <div className="grid grid-cols-3 gap-2">
          <SelectField label={t('m19.pw.cat.fLevel')} name="level" value={draft.level} onChange={(v) => set({ level: v })} disabled={!!draft.id} options={[1, 2, 3].map((l) => ({ value: String(l), label: t('m19.pw.levelLong', { n: l }) }))} />
          <TextField type="number" label={t('m19.pw.adm.colEnvelope')} name="env" value={draft.envelope_months} onChange={(v) => set({ envelope_months: v })} hint={t('m19.pw.adm.envHint')} />
          <TextField type="number" label={t('m19.pw.adm.colWeekly')} name="weekly" value={draft.weekly_hours} onChange={(v) => set({ weekly_hours: v })} />
        </div>
        <TextField label={t('m19.pw.adm.titleEn')} name="title_en" value={draft.title_en} onChange={(v) => set({ title_en: v })} />
        <TextField label={t('m19.pw.adm.titleAr')} name="title_ar" value={draft.title_ar} onChange={(v) => set({ title_ar: v })} />
        <TextArea label={t('m19.pw.adm.outcomeEn')} name="outcome_en" rows={2} value={draft.outcome_en} onChange={(v) => set({ outcome_en: v })} />
        <TextArea label={t('m19.pw.adm.outcomeAr')} name="outcome_ar" rows={2} value={draft.outcome_ar} onChange={(v) => set({ outcome_ar: v })} />
        <SelectField label={t('m19.pw.adm.colStatus')} name="status" value={draft.status} onChange={(v) => set({ status: v })} options={['draft', 'published', 'retired'].map((x) => ({ value: x, label: t(`m19.pw.status.${x}`) }))} />
        <h4 className="caps pt-2">{t('m19.pw.adm.steps')}</h4>
        {draft.steps.map((x, i) => (
          <div key={i} className="space-y-2 rounded-card border border-line p-2.5" data-testid="m19-adm-step">
            <div className="grid grid-cols-2 gap-2">
              <SelectField label={t('m19.pw.adm.colKind')} name={`kind-${i}`} value={x.kind} onChange={(v) => setStep(i, { kind: v })} options={STEP_KINDS.map((k) => ({ value: k, label: t(`m19.pw.kind.${k}`) }))} />
              <TextField type="number" label={t('m19.pw.adm.hours')} name={`hours-${i}`} value={x.hours} onChange={(v) => setStep(i, { hours: v })} />
            </div>
            <TextField label={t('m19.pw.adm.titleEn')} name={`ten-${i}`} value={x.title_en} onChange={(v) => setStep(i, { title_en: v })} />
            <TextField label={t('m19.pw.adm.titleAr')} name={`tar-${i}`} value={x.title_ar} onChange={(v) => setStep(i, { title_ar: v })} />
            <TextField label={t('m19.pw.adm.pins')} name={`pins-${i}`} value={x.pins} onChange={(v) => setStep(i, { pins: v })} hint={t('m19.pw.adm.pinsHint')} />
            {draft.steps.length > 3 && <button type="button" className="btn-ghost btn-sm" onClick={() => set({ steps: draft.steps.filter((_, j) => j !== i) })}>{t('m19.pw.adm.removeStep')}</button>}
          </div>
        ))}
        {draft.steps.length < 8 && <button type="button" className="btn-outline btn-sm" onClick={() => set({ steps: [...draft.steps, { kind: 'practice', title_en: '', title_ar: '', hours: '4', pins: '' }] })}><Icon name="plus" size={14} />{t('m19.pw.adm.addStep')}</button>}
        <p className="text-[12.5px] text-ink-2" data-testid="m19-adm-capacity">{t('m19.pw.adm.capacity', { total: f.num(total), cap: f.num(cap) })}</p>
        <CheckboxField label={t('m19.pw.adm.autoAll')} checked disabled onChange={() => undefined} hint={t('m19.pw.adm.autoHint')} />
        {problems.length > 0 && <div className="rounded-card border border-bad-line bg-bad-bg p-2.5 text-[12.5px]" role="alert" data-testid="m19-adm-problems">{problems.map((p) => <div key={p}>{t(`m19.pw.problem.${p}`)}</div>)}</div>}
      </div>
    </Drawer>
  );
}

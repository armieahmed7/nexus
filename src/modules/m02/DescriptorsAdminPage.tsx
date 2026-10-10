// FS23 /admin/descriptors · Level descriptors editor (framework owners: instructors and the training manager W, admins A; auditors
// read-only): coverage against the acceptance rule (every skill described at each level of its range, nothing outside it, no template
// sentence, EN and AR), a skill table, and an editor per level (essence, 2-4 indicators in EN and AR, evidence modes) with the live
// check (checkDescriptor = SQL kafaa_sd_check) and the range editor (checkRange = kafaa_sd_range_check). Saves go through
// rpc.saveDescriptor / rpc.setLevelRange (audited; in-range levels always published, drafts outside, never deleted).
import { useMemo, useState } from 'react';
import { Async, BenchmarkChips, Callout, CheckboxField, ConfirmDialog, DataTable, Drawer, EmptyState, Page, Section, SelectField, StatTile, StatusPill, Tabs, TextArea, type Column } from '../../ui';
import { useAction, useRepo } from '../../data';
import { usePick, useFormat, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { EVIDENCE_MODES, IND_MAX, IND_MIN, RANGE_BASES, checkDescriptor, checkRange, descriptorCoverage, levelState, type DescriptorInput, type RangeInput } from './descriptors';
import { BasisPill, LEVELS, RangeDots, TrackPill, useLevelName, useLevelsData, type LevelsData, type Row } from './levelsUi';

export default function DescriptorsAdminPage() {
  const t = useT();
  const q = useLevelsData();
  return (
    <Page title={t('m02.routes.admin-descriptors.title')} eyebrow={t('m02.da.eyebrow')} intro={t('m02.da.intro')} wide>
      <div data-testid="m02-bench-fs23"><BenchmarkChips feature="FS23" /></div>
      <Async state={q} isEmpty={(d) => d.skills.length === 0} empty={<EmptyState title={t('m02.lv.empty')} />}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: LevelsData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const canEdit = s.can('frameworks', ['W', 'A']);
  const [sel, setSel] = useState<string | null>(null);
  const pub = useMemo(() => d.descs.filter((x) => x.status === 'published'), [d.descs]);
  const cov = useMemo(() => descriptorCoverage(d.skills, d.ranges, pub), [d.skills, d.ranges, pub]);
  const drafts = d.descs.filter((x) => x.status === 'draft');
  const archived = d.descs.filter((x) => x.status === 'archived');
  const cols: Column<Row>[] = [
    { key: 'name', header: t('m02.da.colSkill'), value: (x) => pick(x, 'name'), sortable: true, render: (x) => <span><button type="button" className="text-start font-medium text-accent hover:underline" onClick={() => setSel(x.id)} data-testid={`m02-da-open-${x.id}`}>{pick(x, 'name')}</button><span className="block text-[11.5px] text-ink-3"><bdi dir="ltr">{x.code}</bdi></span></span> },
    { key: 'range', header: t('m02.da.colRange'), value: (x) => `${d.rangeOf.get(x.id)?.min_level}-${d.rangeOf.get(x.id)?.max_level}`, render: (x) => <RangeDots range={d.rangeOf.get(x.id)} /> },
    { key: 'basis', header: t('m02.da.colBasis'), value: (x) => d.rangeOf.get(x.id)?.basis ?? '', sortable: true, render: (x) => <BasisPill basis={d.rangeOf.get(x.id)?.basis} /> },
    { key: 'track', header: t('m02.da.colTrack'), value: (x) => d.rangeOf.get(x.id)?.track ?? '', sortable: true, render: (x) => <TrackPill track={d.rangeOf.get(x.id)?.track} /> },
    { key: 'status', header: t('m02.da.colStatus'), value: (x) => (cov.missing.some((m) => m.skill_id === x.id) ? 'missing' : 'complete'), sortable: true,
      render: (x) => {
        const miss = cov.missing.filter((m) => m.skill_id === x.id).length;
        const dr = drafts.filter((y) => y.skill_id === x.id).length;
        return <span className="flex flex-wrap gap-1">{miss ? <StatusPill tone="bad">{t('m02.da.missingN', { n: f.num(miss) })}</StatusPill> : <StatusPill tone="ok">{t('m02.da.complete')}</StatusPill>}{dr > 0 && <StatusPill tone="sim">{t('m02.da.draftsN', { n: f.num(dr) })}</StatusPill>}</span>;
      } },
    { key: 'version', header: t('m02.da.colVersion'), value: (x) => Math.max(0, ...d.descs.filter((y) => y.skill_id === x.id).map((y) => Number(y.version))), sortable: true, align: 'end' },
  ];
  return (
    <>
      {!canEdit && <Callout tone="info" title={t('m02.da.readOnly')}>{t('m02.da.readOnlyBody')}</Callout>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="m02-da-tiles">
        <StatTile label={t('m02.dl.tComplete')} value={f.pct(cov.pct, 0)} sub={t('m02.dl.tCompleteSub', { n: f.num(cov.complete), total: f.num(cov.skills) })} tone={cov.complete === cov.skills ? 'ok' : 'bad'} />
        <StatTile label={t('m02.da.tMissing')} value={f.num(cov.missing.length + cov.extra.length)} sub={t('m02.da.tMissingSub')} tone={cov.missing.length + cov.extra.length ? 'bad' : 'ok'} />
        <StatTile label={t('m02.dl.tTemplate')} value={f.num(cov.templated.length)} sub={t('m02.dl.tTemplateSub')} tone={cov.templated.length ? 'bad' : 'ok'} />
        <StatTile label={t('m02.da.tArabic')} value={f.num(cov.noArabic.length)} sub={t('m02.da.tArabicSub')} tone={cov.noArabic.length ? 'bad' : 'ok'} />
        <StatTile label={t('m02.da.tDrafts')} value={f.num(drafts.length)} sub={t('m02.da.tDraftsSub', { n: f.num(archived.length) })} tone="sim" />
      </div>
      <Section title={t('m02.da.tableTitle')} description={t('m02.da.tableDesc')}>
        <div data-testid="m02-da-table"><DataTable rows={d.skills} columns={cols} rowKey={(x) => x.id} pageSize={25} csvName="kafaa-descriptors-coverage.csv" caption={t('m02.da.tableTitle')} /></div>
      </Section>
      {sel && <Editor d={d} skillId={sel} canEdit={canEdit} onClose={() => setSel(null)} />}
    </>
  );
}

type Form = { essence_en: string; essence_ar: string; en: string[]; ar: string[]; modes: string[] };
const emptyForm = (): Form => ({ essence_en: '', essence_ar: '', en: ['', ''], ar: ['', ''], modes: [] });

function Editor({ d, skillId, canEdit, onClose }: { d: LevelsData; skillId: string; canEdit: boolean; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const levelName = useLevelName();
  const s = d.skill.get(skillId)!;
  const r = d.rangeOf.get(skillId);
  return (
    <Drawer open onClose={onClose} title={<span>{pick(s, 'name')} <bdi dir="ltr" className="text-[12px] text-ink-3">{s.code}</bdi></span>}>
      <div className="space-y-3" data-testid="m02-da-editor">
        <div className="flex flex-wrap items-center gap-2"><RangeDots range={r} /><BasisPill basis={r?.basis} /><TrackPill track={r?.track} /></div>
        <Tabs initial={`l${r?.min_level ?? 1}`} tabs={[
          ...LEVELS.map((lv) => ({ id: `l${lv}`, label: <span>{levelName(lv)}{levelState(r, lv) !== 'defined' && <span className="ms-1 text-ink-3">·</span>}</span>, content: <LevelForm key={`${skillId}-${lv}`} d={d} skillId={skillId} level={lv} canEdit={canEdit} /> })),
          { id: 'range', label: t('m02.da.rangeTab'), content: <RangeForm key={`${skillId}-range`} d={d} skillId={skillId} canEdit={canEdit} /> },
        ]} />
      </div>
    </Drawer>
  );
}

function LevelForm({ d, skillId, level, canEdit }: { d: LevelsData; skillId: string; level: number; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const s = d.skill.get(skillId)!;
  const r = d.rangeOf.get(skillId);
  const cur = d.descOf(skillId, level);
  const inRange = levelState(r, level) === 'defined';
  const [form, setForm] = useState<Form>(() => (cur ? { essence_en: cur.essence_en, essence_ar: cur.essence_ar, en: [...cur.indicators_en], ar: [...cur.indicators_ar], modes: [...cur.evidence_modes] } : emptyForm()));
  const [confirm, setConfirm] = useState(false);
  const input: DescriptorInput = { skill_id: skillId, level, essence_en: form.essence_en, essence_ar: form.essence_ar, indicators_en: form.en, indicators_ar: form.ar, evidence_modes: form.modes, publish: inRange };
  const check = checkDescriptor(input, { skill: { id: s.id, area: s.area, fs_area: s.fs_area, lifecycle: s.lifecycle }, range: r });
  const setInd = (lang: 'en' | 'ar', i: number, v: string) => setForm((x) => ({ ...x, [lang]: x[lang].map((y, j) => (j === i ? v : y)) }));
  const addRow = () => setForm((x) => (x.en.length >= IND_MAX ? x : { ...x, en: [...x.en, ''], ar: [...x.ar, ''] }));
  const delRow = (i: number) => setForm((x) => (x.en.length <= IND_MIN ? x : { ...x, en: x.en.filter((_, j) => j !== i), ar: x.ar.filter((_, j) => j !== i) }));
  return (
    <div className="space-y-3 pt-2" data-testid={`m02-da-level-${level}`}>
      <div className="flex flex-wrap gap-2 text-[12px]">
        {cur ? <StatusPill tone={cur.status === 'published' ? 'ok' : cur.status === 'draft' ? 'sim' : 'neutral'}>{t(`m02.da.status.${cur.status}`)}</StatusPill> : <StatusPill tone="neutral">{t('m02.da.status.none')}</StatusPill>}
        {cur && <span className="text-ink-3">{t('m02.da.versionN', { n: f.num(cur.version) })}</span>}
        <span className="text-ink-3">{inRange ? t('m02.da.inRange') : t('m02.da.outRange')}</span>
      </div>
      <TextArea name="f1" label={t('m02.da.essenceEn')} rows={2} value={form.essence_en} onChange={(v) => setForm((x) => ({ ...x, essence_en: v }))} disabled={!canEdit} />
      <div dir="rtl" lang="ar"><TextArea name="f2" label={t('m02.da.essenceAr')} rows={2} value={form.essence_ar} onChange={(v) => setForm((x) => ({ ...x, essence_ar: v }))} disabled={!canEdit} /></div>
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-semibold">{t('m02.da.indicators', { min: f.num(IND_MIN), max: f.num(IND_MAX) })}</legend>
        {form.en.map((_, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-line p-2 md:grid-cols-2" data-testid={`m02-da-ind-${i}`}>
            <TextArea name="f3" label={t('m02.da.indEn', { n: f.num(i + 1) })} rows={2} value={form.en[i]} onChange={(v) => setInd('en', i, v)} disabled={!canEdit} />
            <div dir="rtl" lang="ar"><TextArea name="f4" label={t('m02.da.indAr', { n: f.num(i + 1) })} rows={2} value={form.ar[i] ?? ''} onChange={(v) => setInd('ar', i, v)} disabled={!canEdit} /></div>
            {canEdit && form.en.length > IND_MIN && <button type="button" className="btn-ghost btn-sm justify-self-start" onClick={() => delRow(i)}>{t('m02.da.remove')}</button>}
          </div>
        ))}
        {canEdit && form.en.length < IND_MAX && <button type="button" className="btn-outline btn-sm" onClick={addRow} data-testid="m02-da-add-ind">{t('m02.da.addIndicator')}</button>}
      </fieldset>
      <fieldset>
        <legend className="text-[13px] font-semibold">{t('m02.lv.evidenceModes')}</legend>
        <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {EVIDENCE_MODES.map((m) => (
            <CheckboxField key={m} label={t(`m02.lv.mode.${m}`)} checked={form.modes.includes(m)} disabled={!canEdit}
              onChange={(v) => setForm((x) => ({ ...x, modes: v ? [...x.modes, m] : x.modes.filter((y) => y !== m) }))} />
          ))}
        </div>
      </fieldset>
      <div aria-live="polite" data-testid={`m02-da-check-${level}`}>
        {check === 'ok' ? <Callout tone="ok" title={t('m02.da.checkOk')}>{inRange ? t('m02.da.willPublish') : t('m02.da.willDraft')}</Callout> : <Callout tone="bad" title={t('m02.da.checkFail')}>{t(`m02.da.msg.${check}`)}</Callout>}
      </div>
      {canEdit && <button type="button" className="btn-primary" disabled={check !== 'ok'} onClick={() => setConfirm(true)} data-testid={`m02-da-save-${level}`}>{t('m02.da.save')}</button>}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m02.da.confirmTitle')} consequence={inRange ? t('m02.da.confirmPublish') : t('m02.da.confirmDraft')}
        onConfirm={async () => { await act(() => repo.rpc.saveDescriptor(input)); setConfirm(false); }} />
    </div>
  );
}

function RangeForm({ d, skillId, canEdit }: { d: LevelsData; skillId: string; canEdit: boolean }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const s = d.skill.get(skillId)!;
  const r = d.rangeOf.get(skillId);
  const [form, setForm] = useState({ min: String(r?.min_level ?? 1), max: String(r?.max_level ?? 4), basis: String(r?.basis ?? 'full'), en: String(r?.rationale_en ?? ''), ar: String(r?.rationale_ar ?? '') });
  const [confirm, setConfirm] = useState(false);
  const input: RangeInput = { skill_id: skillId, min_level: Number(form.min), max_level: Number(form.max), basis: form.basis, rationale_en: form.en, rationale_ar: form.ar };
  const levels = d.descs.filter((x) => x.skill_id === skillId).map((x) => Number(x.level));
  const check = checkRange(input, { skill: { id: s.id, area: s.area, fs_area: s.fs_area, lifecycle: s.lifecycle }, levels, current: r });
  const opts = [1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }));
  return (
    <div className="space-y-3 pt-2" data-testid="m02-da-range">
      <p className="text-[12.5px] text-ink-3">{t('m02.da.rangeHint')}</p>
      <div className="grid grid-cols-2 gap-2">
        <SelectField name="f5" label={t('m02.da.min')} value={form.min} options={opts} onChange={(v) => setForm((x) => ({ ...x, min: v }))} disabled={!canEdit} />
        <SelectField name="f6" label={t('m02.da.max')} value={form.max} options={opts} onChange={(v) => setForm((x) => ({ ...x, max: v }))} disabled={!canEdit} />
      </div>
      <SelectField name="f7" label={t('m02.dl.basis')} value={form.basis} options={RANGE_BASES.map((b) => ({ value: b, label: t(`m02.lv.basis.${b}`) }))} onChange={(v) => setForm((x) => ({ ...x, basis: v }))} disabled={!canEdit} />
      <TextArea name="f8" label={t('m02.da.rationaleEn')} rows={3} value={form.en} onChange={(v) => setForm((x) => ({ ...x, en: v }))} disabled={!canEdit} />
      <div dir="rtl" lang="ar"><TextArea name="f9" label={t('m02.da.rationaleAr')} rows={3} value={form.ar} onChange={(v) => setForm((x) => ({ ...x, ar: v }))} disabled={!canEdit} /></div>
      <div aria-live="polite" data-testid="m02-da-range-check">
        {check === 'ok' ? <Callout tone="ok" title={t('m02.da.checkOk')}>{t('m02.da.rangeOk')}</Callout> : <Callout tone={check === 'no_change' ? 'info' : 'bad'} title={check === 'no_change' ? t('m02.da.noChange') : t('m02.da.checkFail')}>{t(`m02.da.msg.${check}`)}</Callout>}
      </div>
      {canEdit && <button type="button" className="btn-primary" disabled={check !== 'ok'} onClick={() => setConfirm(true)} data-testid="m02-da-range-save">{t('m02.da.saveRange')}</button>}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m02.da.confirmRangeTitle')} consequence={t('m02.da.confirmRange')}
        onConfirm={async () => { await act(() => repo.rpc.setLevelRange(input)); setConfirm(false); }} />
    </div>
  );
}

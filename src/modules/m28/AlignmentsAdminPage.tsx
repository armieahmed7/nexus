// FS08 /admin/skills/alignments · crosswalk editing for framework owners (frameworks W/A: instructors, the training manager, admins);
// auditors read. Every row with its status (draft, published, retired), review state, match type, code and source. Add or edit
// (rpc.saveAlignment: an edit bumps the version and makes the row indicative again), review a published row (rpc.reviewAlignment;
// maker-checker: never your own edit) and retire with a reason (rpc.retireAlignment; never deleted). The form runs the same
// checkAlignment rule as both backends before anything is sent.
import { useMemo, useState } from 'react';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useLang, usePick, useT, L } from '../../i18n';
import {
  Async, BenchmarkChips, Callout, CheckboxField, ConfirmDialog, DataTable, EmptyState, FilterBar, Modal, Page, Section, SelectField, StatTile, StatusPill, TextArea, TextField,
  useFilters, type Column,
} from '../../ui';
import { todayIso } from '../../domain/rules';
import type { SkillAlignmentsRow, SkillsRow } from '../../data/types';
import { AL_MSG, CODE_PATTERNS, MATCH_TYPES, canonLevelMap, checkAlignment, isIndicative, type AlignmentInput, type FrameworkId } from './crosswalk';
import { CodeCell, MatchPill, ReviewPill, useCatalogue, type Catalogue } from './ui';

const STATUS_TONE = { draft: 'neutral', published: 'ok', retired: 'bad' } as const;

export default function AlignmentsAdminPage() {
  const t = useT();
  const c = useCatalogue();
  return (
    <Page title={t('m28.routes.admin-skills-alignments.title')} intro={t('m28.admin.intro')} wide actions={<L to="/skills/frameworks" className="btn-outline">{t('m28.admin.public')}</L>}>
      <div data-testid="m28-bench-fs08"><BenchmarkChips feature="FS08" /></div>
      <Async state={c} isEmpty={(d) => d.frameworks.length === 0} empty={<EmptyState title={t('m28.fw.empty')} />}>{(d) => <Admin c={d} />}</Async>
    </Page>
  );
}

function Admin({ c }: { c: Catalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const me = s.identity.personId;
  const canEdit = s.can('frameworks', ['W', 'A']);
  const [flt, setFlt] = useFilters({ afw: '', ast: '', arv: '', amt: '', aq: '' }, true);
  const [edit, setEdit] = useState<SkillAlignmentsRow | 'new' | null>(null);
  const [review, setReview] = useState<SkillAlignmentsRow | null>(null);
  const [retire, setRetire] = useState<SkillAlignmentsRow | null>(null);
  const skillById = useMemo(() => new Map(c.skills.map((x) => [x.id, x])), [c.skills]);
  const all = c.alignments;
  const queue = all.filter((a) => a.status === 'published' && isIndicative(a));
  const mine = queue.filter((a) => a.updated_by !== me);
  const term = flt.aq.trim().toLowerCase();
  const rows = all.filter((a) => (!flt.afw || a.framework === flt.afw) && (!flt.ast || a.status === flt.ast) && (!flt.amt || a.match_type === flt.amt)
    && (!flt.arv || (flt.arv === 'indicative' ? isIndicative(a) : !isIndicative(a)))
    && (!term || `${a.label_en} ${a.label_ar} ${a.external_code ?? ''} ${skillById.get(a.skill_id)?.name_en ?? ''} ${skillById.get(a.skill_id)?.name_ar ?? ''}`.toLowerCase().includes(term)));
  const cols: Column<SkillAlignmentsRow>[] = [
    { key: 'skill', header: t('m28.fw.colSkill'), value: (a) => pick(skillById.get(a.skill_id), 'name'), sortable: true, render: (a) => <L to={`/skills/${a.skill_id}?tab=crosswalk`}>{pick(skillById.get(a.skill_id), 'name')}</L> },
    { key: 'fw', header: t('m28.fw.colFramework'), value: (a) => c.fwById.get(a.framework)?.short ?? a.framework, sortable: true },
    { key: 'label', header: t('m28.fw.colExternal'), value: (a) => (lang === 'ar' ? a.label_ar : a.label_en) },
    { key: 'code', header: t('m28.fw.colCode'), value: (a) => a.external_code ?? '', render: (a) => <CodeCell row={a} /> },
    { key: 'match', header: t('m28.fw.colMatch'), value: (a) => a.match_type, render: (a) => <MatchPill m={a.match_type} /> },
    { key: 'status', header: t('m28.admin.colStatus'), value: (a) => a.status, sortable: true, render: (a) => <span className="flex flex-col items-start gap-0.5"><StatusPill tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE]}>{t(`m28.status.${a.status}`)}</StatusPill>{a.status === 'published' && <ReviewPill row={a} />}</span> },
    { key: 'version', header: t('m28.admin.colVersion'), value: (a) => a.version, align: 'end', render: (a) => <span className="num">{f.num(a.version)}</span> },
    { key: 'asof', header: t('m28.admin.colAsOf'), value: (a) => a.as_of, sortable: true, render: (a) => f.date(a.as_of) },
    { key: 'act', header: t('m28.admin.colActions'), csv: false, render: (a) => canEdit && a.status !== 'retired' ? (
      <span className="flex flex-wrap gap-1">
        <button type="button" className="btn-outline px-2 py-0.5 text-[12px]" onClick={() => setEdit(a)} data-testid={`m28-edit-${a.id}`}>{t('m28.admin.edit')}</button>
        {a.status === 'published' && isIndicative(a) && <button type="button" className="btn-outline px-2 py-0.5 text-[12px]" disabled={a.updated_by === me} title={a.updated_by === me ? AL_MSG.maker_checker : undefined} onClick={() => setReview(a)} data-testid={`m28-review-${a.id}`}>{t('m28.admin.review')}</button>}
        <button type="button" className="btn-outline px-2 py-0.5 text-[12px] text-bad" onClick={() => setRetire(a)} data-testid={`m28-retire-${a.id}`}>{t('m28.admin.retire')}</button>
      </span>
    ) : a.status === 'retired' ? <span className="text-[12px] text-ink-3" title={a.retired_reason ?? ''}>{t('m28.admin.retiredOn', { date: f.date(a.retired_on) })}</span> : null },
  ];
  return (
    <>
      {!canEdit && <Callout tone="info" title={t('m28.admin.readOnly')}><span data-testid="m28-admin-readonly">{t('m28.admin.readOnlyBody')}</span></Callout>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m28-admin-tiles">
        <StatTile label={t('m28.admin.tTotal')} value={f.num(all.length)} sub={t('m28.admin.tTotalSub')} />
        <StatTile label={t('m28.status.draft')} value={f.num(all.filter((a) => a.status === 'draft').length)} sub={t('m28.admin.tDraftSub')} />
        <StatTile label={t('m28.review.indicative')} value={f.num(queue.length)} sub={t('m28.admin.tQueueSub', { n: f.num(mine.length) })} tone="sim" />
        <StatTile label={t('m28.review.reviewed')} value={f.num(all.filter((a) => a.status === 'published' && !isIndicative(a)).length)} sub={t('m28.admin.tReviewedSub')} tone="ok" />
        <StatTile label={t('m28.status.retired')} value={f.num(all.filter((a) => a.status === 'retired').length)} sub={t('m28.admin.tRetiredSub')} tone="bad" />
      </div>
      <Section title={t('m28.admin.listTitle')} actions={canEdit ? <button type="button" className="btn-primary" onClick={() => setEdit('new')} data-testid="m28-add">{t('m28.admin.add')}</button> : undefined}>
        <FilterBar value={flt} onChange={setFlt} search="aq" fields={[
          { key: 'afw', label: t('m28.fw.colFramework'), options: c.frameworks.map((x) => ({ value: x.id, label: x.short })) },
          { key: 'ast', label: t('m28.admin.colStatus'), options: ['draft', 'published', 'retired'].map((x) => ({ value: x, label: t(`m28.status.${x}`) })) },
          { key: 'arv', label: t('m28.fw.colReview'), options: [{ value: 'indicative', label: t('m28.review.indicative') }, { value: 'reviewed', label: t('m28.review.reviewed') }] },
          { key: 'amt', label: t('m28.fw.colMatch'), options: MATCH_TYPES.map((m) => ({ value: m, label: t(`m28.match.${m}.label`) })) },
        ]} />
        {rows.length === 0 ? <EmptyState title={t('m28.fw.noRows')} /> : <div data-testid="m28-admin-table"><DataTable rows={rows} columns={cols} rowKey={(a) => a.id} csvName="kafaa-crosswalk-admin" searchable={false} /></div>}
      </Section>
      {edit && <Editor c={c} row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!review} onClose={() => setReview(null)} title={t('m28.admin.reviewTitle')} consequence={t('m28.admin.reviewConsequence')}
        onConfirm={async () => { const r = await run(() => repo.rpc.reviewAlignment(review!.id)); if (r.ok) setReview(null); }}>
        {review && <p className="text-[13px]">{pick(skillById.get(review.skill_id), 'name')} → <strong>{lang === 'ar' ? review.label_ar : review.label_en}</strong> ({c.fwById.get(review.framework)?.short})</p>}
      </ConfirmDialog>
      <ConfirmDialog open={!!retire} onClose={() => setRetire(null)} title={t('m28.admin.retireTitle')} consequence={t('m28.admin.retireConsequence')} danger requireReason reasonLabel={t('m28.admin.retireReason')}
        onConfirm={async (reason) => { const r = await run(() => repo.rpc.retireAlignment(retire!.id, reason)); if (r.ok) setRetire(null); }} />
    </>
  );
}

function Editor({ c, row, onClose }: { c: Catalogue; row: SkillAlignmentsRow | null; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const lm = canonLevelMap(row?.level_map);
  const [v, setV] = useState({
    skill_id: row?.skill_id ?? '', framework: row?.framework ?? 'esco', external_code: row?.external_code ?? '', label_en: row?.label_en ?? '', label_ar: row?.label_ar ?? '',
    label_ar_official: row?.label_ar_official ?? false, match_type: row?.match_type ?? 'close', l1: lm['1'] ?? '', l2: lm['2'] ?? '', l3: lm['3'] ?? '', l4: lm['4'] ?? '',
    note_en: row?.note_en ?? '', note_ar: row?.note_ar ?? '', source_url: row?.source_url ?? '', as_of: row?.as_of ? String(row.as_of).slice(0, 10) : todayIso(), publish: row ? row.status === 'published' : false,
  });
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof v) => (x: string | boolean) => setV((o) => ({ ...o, [k]: x }));
  const input: AlignmentInput = {
    id: row?.id ?? null, skill_id: v.skill_id, framework: v.framework, external_code: v.external_code || null, label_en: v.label_en, label_ar: v.label_ar, label_ar_official: v.label_ar_official,
    match_type: v.match_type, level_map: { 1: v.l1, 2: v.l2, 3: v.l3, 4: v.l4 }, note_en: v.note_en, note_ar: v.note_ar, source_url: v.source_url, as_of: v.as_of, publish: v.publish,
  };
  input.level_map = Object.fromEntries(Object.entries(input.level_map as Record<string, string>).filter(([, x]) => x.trim()));
  const check = checkAlignment(input, {
    skills: new Map(c.skills.map((x) => [x.id, { lifecycle: x.lifecycle }])), frameworks: new Set(c.frameworks.map((x) => x.id)),
    rows: c.alignments.map((a) => ({ id: a.id, skill_id: a.skill_id, framework: a.framework, external_code: a.external_code, label_en: a.label_en, status: a.status })), today: todayIso(),
  }, row ? { skill_id: row.skill_id, framework: row.framework, status: row.status } : null);
  const pattern = CODE_PATTERNS[v.framework as FrameworkId];
  const skillOpts = (c.skills as SkillsRow[]).filter((x) => x.lifecycle !== 'obsolete' || x.id === row?.skill_id).map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'name')}` }));
  return (
    <Modal open onClose={onClose} size="lg" title={row ? t('m28.admin.editTitle') : t('m28.admin.addTitle')}
      footer={<>
        <button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary" disabled={check !== 'ok'} onClick={() => setConfirm(true)} data-testid="m28-editor-save">{t('common.save')}</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2" data-testid="m28-editor">
        <SelectField label={t('m28.admin.fSkill')} name="m28-skill" value={v.skill_id} onChange={set('skill_id')} options={skillOpts} placeholder={t('m28.admin.choose')} disabled={!!row} />
        <SelectField label={t('m28.fw.colFramework')} name="m28-fw" value={v.framework} onChange={set('framework')} options={c.frameworks.map((x) => ({ value: x.id, label: x.short }))} disabled={!!row} />
        <TextField label={t('m28.admin.fLabelEn')} name="m28-len" value={v.label_en} onChange={set('label_en')} required />
        <TextField label={t('m28.admin.fLabelAr')} name="m28-lar" value={v.label_ar} onChange={set('label_ar')} required />
        <TextField label={t('m28.admin.fCode')} name="m28-code" value={v.external_code} onChange={set('external_code')} hint={pattern ? t('m28.admin.codeHint', { p: pattern }) : t('m28.admin.codeHintNone')} />
        <SelectField label={t('m28.fw.colMatch')} name="m28-match" value={v.match_type} onChange={set('match_type')} options={MATCH_TYPES.map((m) => ({ value: m, label: t(`m28.match.${m}.label`) }))} />
        <TextField label={t('m28.admin.fUrl')} name="m28-url" value={v.source_url} onChange={set('source_url')} required placeholder="https://" />
        <TextField label={t('m28.admin.fAsOf')} name="m28-asof" type="date" value={v.as_of} onChange={set('as_of')} required />
        <fieldset className="sm:col-span-2">
          <legend className="caps mb-1">{t('m28.admin.fLevels')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['l1', 'l2', 'l3', 'l4'] as const).map((k, i) => <TextField key={k} label={t('m28.levels.level', { n: String(i + 1) })} name={`m28-${k}`} value={v[k]} onChange={set(k)} />)}
          </div>
        </fieldset>
        <TextArea label={t('m28.admin.fNoteEn')} name="m28-nen" value={v.note_en} onChange={set('note_en')} rows={2} />
        <TextArea label={t('m28.admin.fNoteAr')} name="m28-nar" value={v.note_ar} onChange={set('note_ar')} rows={2} />
        <CheckboxField label={t('m28.admin.fArOfficial')} checked={v.label_ar_official} onChange={set('label_ar_official')} />
        <CheckboxField label={t('m28.admin.fPublish')} checked={v.publish} onChange={set('publish')} hint={t('m28.admin.fPublishHint')} />
      </div>
      {check !== 'ok' && <div className="mt-3" data-testid="m28-editor-problem"><Callout tone="bad">{t(`m28.check.${check}`)}</Callout></div>}
      {row && <p className="mt-2 text-[12px] text-ink-3">{t('m28.admin.editNote')}</p>}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={row ? t('m28.admin.editTitle') : t('m28.admin.addTitle')} consequence={t('m28.admin.saveConsequence')}
        onConfirm={async () => { const r = await run(() => repo.rpc.saveAlignment(input)); if (r.ok) { setConfirm(false); onClose(); } }} />
    </Modal>
  );
}

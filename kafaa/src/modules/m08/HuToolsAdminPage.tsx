// FS49 /admin/hu-tools (internal_content W: editors, instructors, the training manager): the HU and safety-culture lead's console.
// Content health of every HU tool card (EN and AR complete, at least one live drill or lesson, known situation cues) and of the sourced
// international lessons; edit or add a card. Writes are direct (existing M08 rule) behind a confirmation; the same content rule
// (huCardProblems) runs here before saving and in the database trigger kafaa_fs49_content_guard for every writer.
import { useMemo, useState } from 'react';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, CheckboxField, ConfirmDialog, DataTable, Icon, Modal, Page, Section, SelectField, StatTile, StatusPill, TextArea, TextField, type Column } from '../../ui';
import type { HuToolsRow, OeLessonsRow } from '../../data/types';
import { CUES, CUE_IDS, fs49Coverage, huCardProblems, lessonProblems, liveLinks, type Bi } from './aiCulture';
import { LessonSources, useFs49Data, type Fs49Data } from './aiUi';

type Draft = Omit<HuToolsRow, 'practice'> & { practice: Bi[] };
const EMPTY: Draft = {
  id: '', name_en: '', name_ar: '', description_en: '', description_ar: '', kind: 'conditional', topic: 'ai_automation', sort: 9, ai_en: '', ai_ar: '',
  trap_en: '', trap_ar: '', practice: [{ en: '', ar: '' }, { en: '', ar: '' }], example_en: '', example_ar: '', cues: [], trait_ids: [], drill_ids: [], lesson_ids: [],
};

export default function HuToolsAdminPage() {
  const t = useT();
  const s = useSession();
  const q = useFs49Data(s.identity.personId, { allLessons: true });
  return (
    <Page title={t('m08.routes.admin-hu-tools.title')} eyebrow={<BenchmarkChips feature="FS49" />} intro={t('m08.adm.intro')} wide>
      <Async state={q} isEmpty={() => false}>{(d) => <Body d={d} canEdit={s.can('internal_content', ['W'])} />}</Async>
    </Page>
  );
}

function Body({ d, canEdit }: { d: Fs49Data; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const cov = useMemo(() => fs49Coverage(d.cards as never, d.lessons as never, d.drills as never), [d]);
  const refs = useMemo(() => ({ drills: d.drills.map((x) => x.id), lessons: d.lessons.map((x) => x.id), traits: d.traits.map((x) => x.id) }), [d]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const problemsOf = (c: HuToolsRow) => {
    const p = huCardProblems(c as never, refs);
    const live = liveLinks(c, d.drills as never, d.lessons as never);
    return live.drills.length + live.lessons.length === 0 && !p.includes('links') ? [...p, 'no_live'] : p;
  };
  const cols: Column<HuToolsRow>[] = [
    { key: 'name', header: t('m08.adm.card'), value: (r) => pick(r, 'name'), sortable: true, render: (r) => <span className="font-semibold">{pick(r, 'name')}</span> },
    { key: 'topic', header: t('m08.adm.topic'), value: (r) => r.topic, sortable: true, render: (r) => <StatusPill tone={r.topic === 'ai_automation' ? 'accent' : 'neutral'}>{t(`m08.hu.topic.${r.topic}`)}</StatusPill> },
    { key: 'links', header: t('m08.adm.links'), value: (r) => r.drill_ids.length + r.lesson_ids.length, sortable: true, render: (r) => <span className="text-[12.5px]">{t('m08.adm.linkCounts', { d: f.num(r.drill_ids.length), l: f.num(r.lesson_ids.length) })}</span> },
    { key: 'cues', header: t('m08.adm.cues'), value: (r) => r.cues.length, render: (r) => <span className="text-[12px] text-ink-2">{f.num(r.cues.length)}</span> },
    {
      key: 'health', header: t('m08.adm.health'), value: (r) => problemsOf(r).length, sortable: true,
      render: (r) => { const p = problemsOf(r); return p.length ? <span className="text-[12px] text-bad" data-testid="m08-adm-problem">{p.map((x) => t(`m08.adm.problem.${x}`)).join(' · ')}</span> : <StatusPill tone="ok">{t('m08.adm.ready')}</StatusPill>; },
    },
    ...(canEdit ? [{ key: 'edit', header: '', value: () => '', render: (r: HuToolsRow) => <button className="btn-ghost btn-sm" onClick={() => { setIsNew(false); setEditing({ ...r, practice: (Array.isArray(r.practice) ? r.practice : []) as Bi[] }); }} data-testid="m08-adm-edit" data-id={r.id}>{t('common.edit')}</button> }] : []),
  ];
  const lessons = d.lessons.filter((l) => l.topic === 'ai_automation');
  const lcols: Column<OeLessonsRow>[] = [
    { key: 'title', header: t('m08.oe.lesson'), value: (r) => pick(r, 'title'), sortable: true, render: (r) => <span className="font-semibold">{pick(r, 'title')}</span> },
    { key: 'source', header: t('m08.oe.source'), value: (r) => r.source_kind, render: (r) => <LessonSources lesson={r} /> },
    { key: 'status', header: t('m08.oe.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
    { key: 'health', header: t('m08.adm.health'), value: (r) => lessonProblems(r as never, { drills: refs.drills }).length, render: (r) => { const p = lessonProblems(r as never, { drills: refs.drills }); return p.length ? <span className="text-[12px] text-bad">{p.map((x) => t(`m08.adm.lproblem.${x}`)).join(' · ')}</span> : <StatusPill tone="ok">{t('m08.adm.sourced')}</StatusPill>; } },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="m08-adm-tiles">
        <StatTile label={t('m08.adm.tile.complete')} value={`${f.num(cov.complete)} / ${f.num(cov.cards)}`} tone={cov.complete === cov.cards ? 'ok' : 'bad'} sub={t('m08.adm.tile.completeSub')} />
        <StatTile label={t('m08.adm.tile.linked')} value={`${f.num(cov.liveLinked)} / ${f.num(cov.cards)}`} tone={cov.liveLinked === cov.cards ? 'ok' : 'bad'} sub={t('m08.adm.tile.linkedSub')} />
        <StatTile label={t('m08.adm.tile.drills')} value={f.num(cov.drillsLinked)} sub={t('m08.adm.tile.drillsSub')} />
        <StatTile label={t('m08.adm.tile.lessons')} value={`${f.num(cov.aiLessonsSourced)} / ${f.num(cov.aiLessons)}`} tone={cov.aiLessonsSourced === cov.aiLessons ? 'ok' : 'bad'} sub={t('m08.adm.tile.lessonsSub')} />
      </div>
      <Section title={t('m08.adm.cardsTitle')} description={t('m08.adm.cardsIntro')}
        actions={canEdit ? <button className="btn-primary btn-sm" onClick={() => { setIsNew(true); setEditing({ ...EMPTY, practice: EMPTY.practice.map((x) => ({ ...x })) }); }} data-testid="m08-adm-new"><Icon name="plus" />{t('m08.adm.new')}</button> : undefined}>
        <div data-testid="m08-adm-table"><DataTable rows={d.cards} rowKey={(r) => r.id} columns={cols} csvName="hu-tool-cards" initialSort={{ key: 'topic', dir: 'asc' }} /></div>
      </Section>
      <Section title={t('m08.adm.lessonsTitle')} description={t('m08.adm.lessonsIntro')}>
        <div data-testid="m08-adm-lessons"><DataTable rows={lessons} rowKey={(r) => r.id} columns={lcols} csvName="ai-oe-lessons" /></div>
      </Section>
      {editing && <Editor draft={editing} isNew={isNew} d={d} refs={refs} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Editor({ draft: initial, isNew, d, refs, onClose }: { draft: Draft; isNew: boolean; d: Fs49Data; refs: { drills: string[]; lessons: string[]; traits: string[] }; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [x, setX] = useState<Draft>(initial);
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setX((o) => ({ ...o, [k]: v }));
  const toggle = (k: 'cues' | 'drill_ids' | 'lesson_ids', id: string, on: boolean) => setX((o) => ({ ...o, [k]: on ? [...o[k], id] : o[k].filter((y) => y !== id) }));
  const ai = x.topic === 'ai_automation';
  const idProblem = isNew && (!/^hu-[a-z0-9-]{2,40}$/.test(x.id) || d.cards.some((c) => c.id === x.id));
  const problems = huCardProblems(x as never, refs);
  const drills = d.drills.filter((dr) => (dr.status === 'published' && dr.listed) || x.drill_ids.includes(dr.id));
  const lessons = d.lessons.filter((l) => l.status === 'published' || x.lesson_ids.includes(l.id));
  const tf = (k: keyof Draft, label: string, area = false) => {
    const p = { label, value: String(x[k] ?? ''), onChange: (v: string) => set(k, v as never), name: String(k) };
    return area ? <TextArea rows={2} {...p} /> : <TextField {...p} />;
  };
  const save = async () => {
    const row = { ...x, practice: ai ? x.practice : x.practice.filter((s) => s.en.trim() || s.ar.trim()) };
    const r = await run(() => (isNew ? repo.insert('hu_tools', row as never) : repo.update('hu_tools', x.id, row as never)), { success: t('m08.adm.saved') });
    if (r.ok) onClose();
  };
  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? t('m08.adm.new') : t('m08.adm.editTitle', { name: pick(x, 'name') })}
      footer={<>
        <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={problems.length > 0 || idProblem} onClick={() => setConfirm(true)} data-testid="m08-adm-save">{t('common.save')}</button>
      </>}>
      <div className="space-y-4" data-testid="m08-adm-editor">
        {isNew && (
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label={t('m08.adm.id')} name="id" value={x.id} onChange={(v) => set('id', v.trim())} />
            <SelectField label={t('m08.adm.topic')} name="topic" value={x.topic} onChange={(v) => set('topic', v as Draft['topic'])} options={['ai_automation', 'classic'].map((k) => ({ value: k, label: t(`m08.hu.topic.${k}`) }))} />
            <SelectField label={t('m08.adm.kind')} name="kind" value={x.kind} onChange={(v) => set('kind', v as Draft['kind'])} options={['core', 'conditional'].map((k) => ({ value: k, label: t(`m08.sc.hu.${k}`) }))} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {tf('name_en', t('m08.adm.f.name_en'))}{tf('name_ar', t('m08.adm.f.name_ar'))}
          {tf('description_en', t('m08.adm.f.description_en'), true)}{tf('description_ar', t('m08.adm.f.description_ar'), true)}
          {ai ? <>{tf('trap_en', t('m08.adm.f.trap_en'), true)}{tf('trap_ar', t('m08.adm.f.trap_ar'), true)}{tf('example_en', t('m08.adm.f.example_en'), true)}{tf('example_ar', t('m08.adm.f.example_ar'), true)}</>
            : <>{tf('ai_en', t('m08.adm.f.ai_en'), true)}{tf('ai_ar', t('m08.adm.f.ai_ar'), true)}</>}
        </div>
        {ai && (
          <fieldset className="space-y-2" data-testid="m08-adm-steps">
            <legend className="text-[13px] font-semibold">{t('m08.hu.counter')}</legend>
            {x.practice.map((st, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <TextField label={t('m08.adm.f.step_en', { n: i + 1 })} name={`step-en-${i}`} value={st.en} onChange={(v) => set('practice', x.practice.map((s, j) => (j === i ? { ...s, en: v } : s)))} />
                <TextField label={t('m08.adm.f.step_ar', { n: i + 1 })} name={`step-ar-${i}`} value={st.ar} onChange={(v) => set('practice', x.practice.map((s, j) => (j === i ? { ...s, ar: v } : s)))} />
              </div>
            ))}
            {x.practice.length < 6 && <button type="button" className="btn-ghost btn-sm" onClick={() => set('practice', [...x.practice, { en: '', ar: '' }])} data-testid="m08-adm-add-step"><Icon name="plus" />{t('m08.adm.addStep')}</button>}
          </fieldset>
        )}
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold">{t('m08.adm.cues')}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {CUE_IDS.map((c) => <CheckboxField key={c} label={lang === 'ar' ? CUES[c].ar : CUES[c].en} checked={x.cues.includes(c)} onChange={(v) => toggle('cues', c, v)} />)}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset data-testid="m08-adm-drills">
            <legend className="mb-1 text-[13px] font-semibold">{t('m08.adm.drills')}</legend>
            {drills.map((dr) => <CheckboxField key={dr.id} label={pick(dr, 'title')} checked={x.drill_ids.includes(dr.id)} onChange={(v) => toggle('drill_ids', dr.id, v)} />)}
          </fieldset>
          <fieldset data-testid="m08-adm-lesson-links">
            <legend className="mb-1 text-[13px] font-semibold">{t('m08.adm.lessons')}</legend>
            {lessons.map((l) => <CheckboxField key={l.id} label={pick(l, 'title')} checked={x.lesson_ids.includes(l.id)} onChange={(v) => toggle('lesson_ids', l.id, v)} />)}
          </fieldset>
        </div>
        <div aria-live="polite" data-testid="m08-adm-check">
          {problems.length || idProblem ? (
            <ul className="list-disc space-y-0.5 ps-5 text-[12.5px] text-bad">
              {idProblem && <li>{t('m08.adm.problem.id')}</li>}
              {problems.map((p) => <li key={p}>{t(`m08.adm.problem.${p}`)}</li>)}
            </ul>
          ) : <p className="text-[12.5px] text-ok">{t('m08.adm.checkOk')}</p>}
        </div>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m08.adm.confirmTitle')} consequence={t('m08.adm.confirmBody')} actingAs={t('m08.oe.actingEditor')}
        onConfirm={async () => { setConfirm(false); await save(); }} />
    </Modal>
  );
}

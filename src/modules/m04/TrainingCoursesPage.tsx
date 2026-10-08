// /training/courses (M04): SAT-based course builder (objectives tied to competencies, modality, prerequisites, modules,
// linked evaluation, packaging) and role-based mandatory curricula with the curriculum sync.
import { useMemo, useState } from 'react';
import { Page, Tabs, DataTable, Drawer, Modal, ConfirmDialog, FilterBar, useFilters, Async, Callout, Icon, TextField, TextArea, SelectField, CheckboxField, useForm, required, maxLen, numberRange, pattern, Card } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import type { CoursesRow } from '../../data/types';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Chip, G2Pill, useCatalogue, useLabels } from './ui';

const MODALITIES = ['classroom', 'ojt', 'simulator', 'elearning', 'drill', 'external', 'blended', 'clinic'] as const;

export default function TrainingCoursesPage() {
  const t = useT();
  return (
    <Page title={t('m04.routes.training-courses.title')} intro={t('m04.builder.intro')} wide>
      <Tabs initial="courses" tabs={[
        { id: 'courses', label: t('m04.builder.tabCourses'), content: <Courses /> },
        { id: 'curricula', label: t('m04.builder.tabCurricula'), content: <Curricula /> },
      ]} />
    </Page>
  );
}

function Courses() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels();
  const cat = useCatalogue();
  const s = useSession();
  const canEdit = s.can('training', ['W']);
  const [flt, setFlt] = useFilters({ q: '', programme: '', modality: '', mandatory: '', qualifying: '' }, true);
  const [edit, setEdit] = useState<CoursesRow | 'new' | null>(null);
  const rows = cat.courses.filter((c) => (!flt.programme || c.programme_id === flt.programme) && (!flt.modality || c.modality === flt.modality) && (!flt.mandatory || String(c.mandatory) === flt.mandatory) && (!flt.qualifying || String(c.qualifying) === flt.qualifying)
    && (!flt.q || `${c.code} ${c.title_en} ${c.title_ar}`.toLowerCase().includes(flt.q.toLowerCase())));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'programme', label: t('m04.course.programme'), options: cat.programmes.map((p) => ({ value: p.id, label: pick(p, 'name') })) },
          { key: 'modality', label: t('m04.learn.fModality'), options: MODALITIES.map((m) => ({ value: m, label: lab.modality(m) })) },
          { key: 'mandatory', label: t('m04.learn.fMandatory'), options: [{ value: 'true', label: t('m04.common.mandatory') }, { value: 'false', label: t('m04.common.elective') }] },
          { key: 'qualifying', label: t('m04.status.qualifying'), options: [{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }] },
        ]} />
        {canEdit && <button className="btn-primary" onClick={() => setEdit('new')} data-testid="m04-course-new"><Icon name="plus" />{t('m04.builder.new')}</button>}
      </div>
      <Async state={cat.state}>
        {() => (
          <DataTable rows={rows} rowKey={(r) => r.id} csvName="courses" searchable={false} onRowClick={canEdit ? (r) => setEdit(r) : undefined} initialSort={{ key: 'code', dir: 'asc' }} columns={[
            { key: 'code', header: t('m04.common.code'), value: (r) => r.code, render: (r) => <span className="ltr num font-semibold">{r.code}</span>, sortable: true },
            { key: 'title', header: t('m04.common.title'), value: (r) => pick(r, 'title'), render: (r) => <L to={`/learn/course/${r.id}`} onClick={(e) => e.stopPropagation()}>{pick(r, 'title')}</L>, sortable: true },
            { key: 'programme', header: t('m04.course.programme'), value: (r) => pick(cat.programme.get(r.programme_id ?? ''), 'name') },
            { key: 'modality', header: t('m04.learn.fModality'), value: (r) => lab.modality(r.modality) },
            { key: 'hours', header: t('m04.common.hoursCol'), value: (r) => r.duration_hours ?? null, align: 'end', sortable: true },
            { key: 'flags', header: '', value: (r) => [r.mandatory ? 'mandatory' : '', r.qualifying ? 'qualifying' : ''].join(' '), render: (r) => <div className="flex flex-wrap gap-1">{r.mandatory && <Chip tone="accent">{t('m04.common.mandatory')}</Chip>}{r.qualifying && <G2Pill status="qualifying" tone="info" />}{r.public_summary && <Chip>{t('m04.builder.public')}</Chip>}</div> },
            { key: 'eval', header: t('m04.builder.evaluation'), value: (r) => r.evaluation_form_id ?? '' , render: (r) => r.evaluation_form_id ? <span className="num text-[12px]">{r.evaluation_form_id}</span> : r.qualifying ? <G2Pill status="missing" tone="bad" /> : '—' },
          ]} />
        )}
      </Async>
      <p className="text-[12.5px] text-ink-3">{t('m04.builder.count', { n: f.num(rows.length) })}</p>
      {edit && <CourseDrawer course={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CourseDrawer({ course, onClose }: { course: CoursesRow | null; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const lab = useLabels();
  const repo = useRepo();
  const run = useAction();
  const cat = useCatalogue();
  const deps = useQuery(['competencies', 'assessment_forms', 'course_modules'], async () => {
    const [comps, forms, modules] = await Promise.all([repo.list('competencies', { order: [['code', 'asc']] }), repo.list('assessment_forms').catch(() => []), course ? repo.list('course_modules', { filter: { course_id: course.id }, order: [['n', 'asc']] }) : Promise.resolve([])]);
    return { comps, forms: forms.filter((x) => !x.is_practice), modules };
  }, [course?.id]);
  const objectives = (Array.isArray(course?.objectives) ? course!.objectives : []) as { competency_id?: string; en: string; ar: string }[];
  const form = useForm({
    code: course?.code ?? '', title_en: course?.title_en ?? '', title_ar: course?.title_ar ?? '', programme_id: course?.programme_id ?? '', modality: course?.modality ?? 'classroom',
    audience: course?.audience ?? 'staff', duration_hours: course?.duration_hours != null ? String(course.duration_hours) : '', pass_mark: course?.pass_mark != null ? String(course.pass_mark) : '',
    validity_months: course?.validity_months != null ? String(course.validity_months) : '', packaging: course?.packaging ?? 'none', evaluation_form_id: course?.evaluation_form_id ?? '',
    objectives_en: objectives.map((o) => o.en).join('\n'), objectives_ar: objectives.map((o) => o.ar).join('\n'), summary_en: course?.summary_en ?? '', summary_ar: course?.summary_ar ?? '',
  }, {
    code: [required(), pattern(/^[A-Z0-9][A-Z0-9 -]{1,20}$/)], title_en: [required(), maxLen(160)], title_ar: [required(), maxLen(160)], modality: [required()], duration_hours: [numberRange(0.25, 4000)],
    pass_mark: [numberRange(1, 100)], validity_months: [numberRange(1, 120)], evaluation_form_id: [(v, all) => (flags.qualifying && !v ? 'm04.builder.needForm' : null) as string | null],
  });
  const [flags, setFlags] = useState({ initial: course?.initial ?? true, mandatory: course?.mandatory ?? false, qualifying: course?.qualifying ?? false, public_summary: course?.public_summary ?? false });
  const [comps, setComps] = useState<string[]>(course?.competency_ids ?? []);
  const [prereq, setPrereq] = useState<string[]>(course?.prerequisites ?? []);
  const [mod, setMod] = useState(false);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = form.handleSubmit(async (v) => {
    const en = v.objectives_en.split('\n').map((x) => x.trim()).filter(Boolean);
    const ar = v.objectives_ar.split('\n').map((x) => x.trim()).filter(Boolean);
    const objs = en.map((x, i) => ({ en: x, ar: ar[i] ?? x, ...(comps[i] ? { competency_id: comps[i] } : {}) }));
    const row: Partial<CoursesRow> = {
      code: v.code.trim(), title_en: v.title_en.trim(), title_ar: v.title_ar.trim(), programme_id: v.programme_id || null, modality: v.modality as CoursesRow['modality'], audience: v.audience as CoursesRow['audience'],
      initial: flags.initial, mandatory: flags.mandatory, qualifying: flags.qualifying, public_summary: flags.public_summary, competency_ids: comps, prerequisites: prereq, objectives: objs,
      duration_hours: v.duration_hours ? Number(v.duration_hours) : null, pass_mark: v.pass_mark ? Number(v.pass_mark) : null, validity_months: v.validity_months ? Number(v.validity_months) : null,
      packaging: v.packaging as CoursesRow['packaging'], evaluation_form_id: v.evaluation_form_id || null, summary_en: v.summary_en, summary_ar: v.summary_ar,
    };
    const r = course ? await run(() => repo.update('courses', course.id, row), { success: t('m04.builder.saved') }) : await run(() => repo.insert('courses', { ...row, id: `c-${v.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }), { success: t('m04.builder.created') });
    if (r.ok) onClose();
  });

  return (
    <Drawer open onClose={onClose} title={course ? `${course.code} · ${pick(course, 'title')}` : t('m04.builder.new')}
      footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" onClick={save} disabled={form.submitting} data-testid="m04-course-save">{t('common.save')}</button></>}>
      <Async state={deps}>
        {(d) => (
          <form className="space-y-4" onSubmit={save}>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label={t('m04.common.code')} required hint={t('m04.builder.codeHint')} {...form.field('code')} />
              <SelectField label={t('m04.course.programme')} options={cat.programmes.map((p) => ({ value: p.id, label: pick(p, 'name') }))} {...form.field('programme_id')} />
              <TextField label={t('m04.builder.titleEn')} required {...form.field('title_en')} />
              <TextField label={t('m04.builder.titleAr')} required {...form.field('title_ar')} />
              <SelectField label={t('m04.learn.fModality')} required options={MODALITIES.map((m) => ({ value: m, label: lab.modality(m) }))} {...form.field('modality')} />
              <SelectField label={t('m04.builder.audience')} options={['staff', 'contractor', 'supplier', 'public'].map((a) => ({ value: a, label: lab.audience(a) }))} {...form.field('audience')} />
              <TextField label={t('m04.course.duration')} type="number" {...form.field('duration_hours')} />
              <SelectField label={t('m04.builder.packaging')} hint={t('m04.builder.packagingHint')} options={[{ value: 'none', label: t('m04.builder.none') }, { value: 'scorm', label: 'SCORM' }, { value: 'xapi', label: 'xAPI' }]} {...form.field('packaging')} />
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="caps mb-1">{t('m04.builder.flags')}</legend>
              <CheckboxField label={t('m04.common.initial')} checked={flags.initial} onChange={(v) => setFlags({ ...flags, initial: v })} />
              <CheckboxField label={t('m04.common.mandatory')} hint={t('m04.builder.mandatoryHint')} checked={flags.mandatory} onChange={(v) => setFlags({ ...flags, mandatory: v })} />
              <CheckboxField label={t('m04.status.qualifying')} hint={t('m04.builder.qualifyingHint')} checked={flags.qualifying} onChange={(v) => setFlags({ ...flags, qualifying: v })} />
              <CheckboxField label={t('m04.builder.publicSummary')} hint={t('m04.builder.publicHint')} checked={flags.public_summary} onChange={(v) => setFlags({ ...flags, public_summary: v })} />
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField label={t('m04.builder.evaluation')} required={flags.qualifying} options={d.forms.map((x) => ({ value: x.id, label: `${pick(x, 'title')} (${lab.formKind(x.kind)})` }))} {...form.field('evaluation_form_id')} />
              <TextField label={t('m04.course.passMark')} type="number" {...form.field('pass_mark')} />
              <TextField label={t('m04.builder.validityMonths')} type="number" {...form.field('validity_months')} />
            </div>
            <div>
              <div className="caps mb-1">{t('m04.course.competencies')}</div>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto rounded-btn border border-line p-2">
                {d.comps.map((c) => <button type="button" key={c.id} onClick={() => setComps(toggle(comps, c.id))} aria-pressed={comps.includes(c.id)} className={`chip ${comps.includes(c.id) ? 'border-accent/40 bg-accent-soft text-eyebrow' : 'border-line bg-sunken text-ink-2'}`}>{c.code} · {pick(c, 'name')}</button>)}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextArea label={t('m04.builder.objectivesEn')} hint={t('m04.builder.objectivesHint')} rows={4} {...form.field('objectives_en')} />
              <TextArea label={t('m04.builder.objectivesAr')} rows={4} {...form.field('objectives_ar')} />
              <TextArea label={t('m04.builder.summaryEn')} rows={3} {...form.field('summary_en')} />
              <TextArea label={t('m04.builder.summaryAr')} rows={3} {...form.field('summary_ar')} />
            </div>
            <div>
              <div className="caps mb-1">{t('m04.course.prerequisites')}</div>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-auto rounded-btn border border-line p-2">
                {cat.courses.filter((c) => c.id !== course?.id && c.audience === 'staff').map((c) => <button type="button" key={c.id} onClick={() => setPrereq(toggle(prereq, c.id))} aria-pressed={prereq.includes(c.id)} className={`chip ${prereq.includes(c.id) ? 'border-accent/40 bg-accent-soft text-eyebrow' : 'border-line bg-sunken text-ink-2'}`}>{c.code}</button>)}
              </div>
            </div>
            {course && (
              <Card title={t('m04.course.modules')} actions={<button type="button" className="btn-outline btn-sm" onClick={() => setMod(true)}><Icon name="plus" size={14} />{t('m04.builder.addModule')}</button>}>
                {d.modules.length === 0 ? <p className="text-ink-3">{t('m04.course.noModules')}</p> : <ol className="space-y-1 text-[13.5px]">{d.modules.map((m) => <li key={m.id}>{m.n}. {pick(m, 'title')} · {t('m04.common.minutes', { n: m.minutes })}</li>)}</ol>}
              </Card>
            )}
            {flags.qualifying && <Callout title={t('m04.course.evaluationTitle')}>{t('m04.course.evaluationBody')}</Callout>}
          </form>
        )}
      </Async>
      {mod && course && <ModuleModal courseId={course.id} next={(deps.data?.modules.length ?? 0) + 1} publicSummary={course.public_summary} onClose={() => setMod(false)} />}
    </Drawer>
  );
}

function ModuleModal({ courseId, next, publicSummary, onClose }: { courseId: string; next: number; publicSummary: boolean; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ title_en: '', title_ar: '', minutes: '60' }, { title_en: [required()], title_ar: [required()], minutes: [required(), numberRange(5, 6000)] });
  return (
    <Modal open onClose={onClose} title={t('m04.builder.addModule')} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" form="m04-mod-form" type="submit">{t('common.save')}</button></>}>
      <form id="m04-mod-form" className="grid gap-3" onSubmit={form.handleSubmit(async (v) => {
        const r = await run(() => repo.insert('course_modules', { id: `${courseId}-m${next}-${Date.now().toString(36)}`, course_id: courseId, n: next, title_en: v.title_en.trim(), title_ar: v.title_ar.trim(), minutes: Number(v.minutes), public_summary: publicSummary }), { success: t('m04.builder.moduleSaved') });
        if (r.ok) onClose();
      })}>
        <TextField label={t('m04.builder.titleEn')} required {...form.field('title_en')} />
        <TextField label={t('m04.builder.titleAr')} required {...form.field('title_ar')} />
        <TextField label={t('m04.builder.minutes')} type="number" required {...form.field('minutes')} />
      </form>
    </Modal>
  );
}

function Curricula() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const cat = useCatalogue();
  const canEdit = s.can('training', ['W']);
  const q = useQuery(['curriculum_rules', 'job_roles'], async () => {
    const [rules, roles] = await Promise.all([repo.list('curriculum_rules'), repo.list('job_roles', { order: [['sort', 'asc']] })]);
    return { rules, roles };
  }, []);
  const [role, setRole] = useState('local-operator');
  const [add, setAdd] = useState(false);
  const [sync, setSync] = useState(false);
  const form = useForm({ course: '', days: '90' }, { course: [required()], days: [required(), numberRange(1, 730)] });
  const roleRules = useMemo(() => (q.data?.rules ?? []).filter((r) => r.role_id === role), [q.data, role]);
  return (
    <Async state={q}>
      {(d) => (
        <div className="space-y-3">
          <Callout title={t('m04.builder.curriculaTitle')}>{t('m04.builder.curriculaBody')}</Callout>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="flex flex-col gap-1"><span className="caps">{t('m04.builder.role')}</span>
              <select className="input min-w-[260px]" value={role} onChange={(e) => setRole(e.target.value)} data-testid="m04-curriculum-role">{d.roles.map((r) => <option key={r.id} value={r.id}>{pick(r, 'title')}</option>)}</select>
            </label>
            {canEdit && <div className="flex gap-2"><button className="btn-outline" onClick={() => { form.reset(); setAdd(true); }}><Icon name="plus" />{t('m04.builder.addRule')}</button><button className="btn-primary" onClick={() => setSync(true)} data-testid="m04-sync"><Icon name="reset" />{t('m04.builder.runSync')}</button></div>}
          </div>
          <DataTable rows={roleRules} rowKey={(r) => r.id} searchable={false} csvName={`curriculum-${role}`} empty={t('m04.builder.noRules')} columns={[
            { key: 'code', header: t('m04.common.code'), value: (r) => cat.course.get(r.course_id)?.code ?? r.course_id, render: (r) => <span className="ltr num">{cat.course.get(r.course_id)?.code ?? r.course_id}</span> },
            { key: 'course', header: t('m04.common.course'), value: (r) => pick(cat.course.get(r.course_id), 'title') },
            { key: 'due', header: t('m04.builder.dueWithin'), value: (r) => r.due_within_days, render: (r) => t('m04.builder.days', { n: f.num(r.due_within_days) }), align: 'end' },
            { key: 'mand', header: t('m04.common.mandatory'), value: (r) => (r.mandatory ? 1 : 0), render: (r) => canEdit ? <input type="checkbox" className="h-4 w-4" checked={r.mandatory} aria-label={t('m04.common.mandatory')} onChange={(e) => run(() => repo.update('curriculum_rules', r.id, { mandatory: e.target.checked }), { success: t('m04.builder.ruleSaved') })} /> : r.mandatory ? t('common.yes') : t('common.no') },
          ]} />
          <Modal open={add} onClose={() => setAdd(false)} title={t('m04.builder.addRule')} footer={<><button className="btn-outline" onClick={() => setAdd(false)}>{t('common.cancel')}</button><button className="btn-primary" form="m04-rule-form" type="submit">{t('common.save')}</button></>}>
            <form id="m04-rule-form" className="grid gap-3" onSubmit={form.handleSubmit(async (v) => {
              if (roleRules.some((r) => r.course_id === v.course)) return;
              const r = await run(() => repo.insert('curriculum_rules', { id: `cr-${role}-${v.course}`, role_id: role, course_id: v.course, mandatory: true, due_within_days: Number(v.days) }), { success: t('m04.builder.ruleSaved') });
              if (r.ok) setAdd(false);
            })}>
              <SelectField label={t('m04.common.course')} required options={cat.courses.filter((c) => c.audience === 'staff' && !roleRules.some((r) => r.course_id === c.id)).map((c) => ({ value: c.id, label: `${c.code} · ${pick(c, 'title')}` }))} {...form.field('course')} />
              <TextField label={t('m04.builder.dueWithin')} type="number" required {...form.field('days')} />
            </form>
          </Modal>
          <ConfirmDialog open={sync} onClose={() => setSync(false)} title={t('m04.builder.syncTitle')} consequence={t('m04.builder.syncBody')} actingAs={t('m04.common.roleTraining')}
            onConfirm={async () => { await run(() => repo.rpc.curriculumSync(null)); }} />
        </div>
      )}
    </Async>
  );
}

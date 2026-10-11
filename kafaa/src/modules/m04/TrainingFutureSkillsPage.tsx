// FS19 /training/future-skills (instructors, training manager): the course pack studio. Coverage of the future skills by pack courses
// (which skills each course teaches and at what level, and which future skills nothing teaches yet), the copy and link check per course
// (stored result; "Run the check" re-runs it for every course) and the skill-link editor (training W): 1-8 skills per course at level
// 1-3 with EN/AR objectives; security skills are never offered; a saved link becomes the course's evidence key on the skill.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, BenchmarkChips, Icon, StatTile, Tabs, DataTable, ConfirmDialog, SelectField, TextField, EmptyState, StatusPill } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { MAX_LINKS, type CopyProblem } from './fsPack';
import { LevelDots, SkillChip, ThemeChip, Simulated, usePackData, type PackData, type Row } from './fsUi';

export default function TrainingFutureSkillsPage() {
  const t = useT();
  const q = usePackData();
  return (
    <Page title={t('m04.routes.training-future-skills.title')} intro={t('m04.fst.intro')} wide eyebrow={<BenchmarkChips feature="FS19" />}>
      <Async state={q}>{(d) => <Studio d={d} />}</Async>
    </Page>
  );
}

function Studio({ d }: { d: PackData }) {
  const t = useT();
  const f = useFormat();
  const passed = d.items.filter((i) => i.copy_check === 'passed').length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('m04.fst.tile.courses')} value={f.num(d.items.length)} />
        <StatTile label={t('m04.fst.tile.links')} value={f.num(d.links.length)} />
        <StatTile label={t('m04.fst.tile.future')} value={`${f.num(d.coverage.futureCovered)}/${f.num(d.coverage.future)}`} sub={t('m04.fst.tile.futureSub')} tone="info" />
        <StatTile label={t('m04.fst.tile.check')} value={`${f.num(passed)}/${f.num(d.items.length)}`} sub={t('m04.fst.tile.checkSub')} tone={passed === d.items.length ? 'ok' : 'bad'} />
      </div>
      <Tabs initial="coverage" tabs={[
        { id: 'coverage', label: t('m04.fst.tab.coverage'), content: <Coverage d={d} /> },
        { id: 'check', label: t('m04.fst.tab.check'), content: <CopyCheck d={d} /> },
        { id: 'links', label: t('m04.fst.tab.links'), content: <LinkEditor d={d} /> },
      ]} />
    </div>
  );
}

function Coverage({ d }: { d: PackData }) {
  const t = useT();
  const pick = usePick();
  const fut = [...d.skills.values()].filter((s) => s.fs_area && s.lifecycle !== 'obsolete').sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0));
  const byArea = new Map<string, Row[]>();
  for (const s of fut) (byArea.get(s.fs_area) ?? byArea.set(s.fs_area, []).get(s.fs_area)!).push(s);
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-2">{t('m04.fst.coverage.intro')}</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m04-fst-coverage">
        {[...byArea].map(([area, list]) => (
          <Card key={area} title={t(`fs.area.${area}`)}>
            <ul className="space-y-1.5 text-[13px]">
              {list.map((s) => {
                const r = d.routeOf.get(s.id);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2" data-skill={s.id} data-covered={r?.courses.length ? 'yes' : 'no'}>
                    <L to={`/skills/${s.id}`} className="min-w-0 truncate">{pick(s, 'name')}</L>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r?.courses.length ? r.courses.map((c) => <span key={c.course_id} className="chip gap-1 border-line bg-sunken normal-case tracking-normal"><bdi dir="ltr" className="num">{d.courseOf.get(c.course_id)?.code}</bdi><LevelDots level={c.level} /></span>)
                        : <StatusPill tone="sim">{t('m04.fst.coverage.noRoute')}</StatusPill>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
      {d.coverage.uncovered.length > 0 && <Callout tone="sim" title={t('m04.fst.coverage.gapTitle', { n: d.coverage.uncovered.length })}>{t('m04.fst.coverage.gapBody')}</Callout>}
    </div>
  );
}

function CopyCheck({ d }: { d: PackData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [confirm, setConfirm] = useState(false);
  const canW = s.can('training', ['W']);
  const problemText = (p: CopyProblem) => t(`m04.fst.problem.${p.code}`, { detail: p.detail });
  return (
    <div className="space-y-3">
      <Callout tone="info" title={t('m04.fst.check.howTitle')}>{t('m04.fst.check.howBody')}</Callout>
      <DataTable rows={d.items} rowKey={(r) => r.course_id} csvName="pack-copy-check" pageSize={25} caption={t('m04.fst.tab.check')}
        toolbar={canW ? <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m04-fst-run"><Icon name="shield" size={14} />{t('m04.fst.check.run')}</button> : null}
        columns={[
          { key: 'code', header: t('m04.common.code'), value: (r) => d.courseOf.get(r.course_id)?.code ?? r.course_id, sortable: true },
          { key: 'title', header: t('m04.common.course'), value: (r) => pick(d.courseOf.get(r.course_id), 'title'), render: (r) => <L to={`/learn/course/${r.course_id}`}>{pick(d.courseOf.get(r.course_id), 'title')}</L> },
          { key: 'theme', header: t('m04.fsc.filter.theme'), value: (r) => t(`m04.fsc.theme.${r.theme}`), render: (r) => <ThemeChip theme={r.theme} /> },
          { key: 'result', header: t('m04.fst.check.result'), value: (r) => r.copy_check, render: (r) => <span data-testid="m04-fst-result" data-result={r.copy_check}><StatusPill tone={r.copy_check === 'passed' ? 'ok' : r.copy_check === 'failed' ? 'bad' : 'neutral'}>{t(`m04.fst.check.${r.copy_check}`)}</StatusPill></span> },
          { key: 'problems', header: t('m04.fst.check.problems'), csv: false, render: (r) => (r.copy_problems ?? []).length ? <ul className="list-disc ps-4 text-[12.5px] text-bad">{(r.copy_problems as CopyProblem[]).map((p, i) => <li key={i}>{problemText(p)}</li>)}</ul> : <span className="text-ink-3">—</span> },
          { key: 'at', header: t('m04.fst.check.at'), value: (r) => (r.copy_checked_at ? f.date(r.copy_checked_at) : '—') },
        ]} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m04.fst.check.run')} consequence={t('m04.fst.check.consequence', { n: f.num(d.items.length) })} actingAs={t('m04.common.roleTraining')}
        onConfirm={async () => { await run(() => repo.rpc.checkCoursePack(), { success: t('m04.fst.check.done') }); }} />
    </div>
  );
}

interface Draft { skill_id: string; level: string; objective_en: string; objective_ar: string }
function LinkEditor({ d }: { d: PackData }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canW = s.can('training', ['W']);
  const [courseId, setCourseId] = useState('');
  const [rows, setRows] = useState<Draft[]>([]);
  const [confirm, setConfirm] = useState(false);
  const options = useMemo(() => [...d.skills.values()].filter((k) => k.area !== 'security' && k.lifecycle !== 'obsolete').sort((a, b) => String(pick(a, 'name')).localeCompare(String(pick(b, 'name'))))
    .map((k) => ({ value: k.id, label: pick(k, 'name') })), [d.skills, pick]);
  const choose = (id: string) => {
    setCourseId(id);
    setRows(d.linksOf(id).map((l) => ({ skill_id: l.skill_id, level: String(l.level), objective_en: l.objective_en, objective_ar: l.objective_ar })));
  };
  const set = (i: number, patch: Partial<Draft>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const item = d.itemOf.get(courseId);
  if (!canW) return <Callout tone="info" title={t('m04.fst.links.readOnlyTitle')}>{t('m04.fst.links.readOnly')}</Callout>;
  return (
    <div className="space-y-3" data-testid="m04-fst-editor">
      <div className="w-full max-w-md">
        <SelectField name="m04-fst-course" label={t('m04.fst.links.course')} value={courseId} onChange={choose} placeholder={t('common.choose')}
          options={d.items.map((i) => ({ value: i.course_id, label: `${d.courseOf.get(i.course_id)?.code ?? ''} · ${pick(d.courseOf.get(i.course_id), 'title')}` }))} />
      </div>
      {!courseId ? <EmptyState icon="book" title={t('m04.fst.links.pick')} /> : (
        <Card title={<span className="flex flex-wrap items-center gap-2">{pick(d.courseOf.get(courseId), 'title')}{item && <ThemeChip theme={item.theme} />}<Simulated /></span>}>
          <ol className="space-y-3">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-1 gap-2 rounded-card border border-line p-3 md:grid-cols-[2fr_1fr]" data-testid="m04-fst-link">
                <SelectField name={`m04-fst-skill-${i}`} label={t('m04.fst.links.skill')} value={r.skill_id} onChange={(v) => set(i, { skill_id: v })} options={options} />
                <SelectField name={`m04-fst-level-${i}`} label={t('m04.fst.links.level')} value={r.level} onChange={(v) => set(i, { level: v })} options={['1', '2', '3'].map((v) => ({ value: v, label: t('m04.fsc.levelN', { n: v }) }))} />
                <TextField name={`m04-fst-en-${i}`} label={t('m04.fst.links.objEn')} value={r.objective_en} onChange={(v) => set(i, { objective_en: v })} />
                <TextField name={`m04-fst-ar-${i}`} label={t('m04.fst.links.objAr')} value={r.objective_ar} onChange={(v) => set(i, { objective_ar: v })} />
                <div className="md:col-span-2"><button type="button" className="btn-ghost btn-sm" onClick={() => setRows((x) => x.filter((_, k) => k !== i))}>{t('m04.fst.links.remove')}</button></div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-outline btn-sm" disabled={rows.length >= MAX_LINKS} onClick={() => setRows((x) => [...x, { skill_id: '', level: '1', objective_en: '', objective_ar: '' }])}><Icon name="plus" size={13} />{t('m04.fst.links.add')}</button>
            <button type="button" className="btn-primary btn-sm" disabled={!rows.length} onClick={() => setConfirm(true)} data-testid="m04-fst-save">{t('m04.fst.links.save')}</button>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">{t('m04.fst.links.note')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{d.linksOf(courseId).map((l) => <SkillChip key={l.id} skill={d.skills.get(l.skill_id)} level={Number(l.level)} />)}</div>
        </Card>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m04.fst.links.save')} consequence={t('m04.fst.links.consequence')} actingAs={t('m04.common.roleTraining')}
        onConfirm={async () => { await run(() => repo.rpc.saveCourseSkills(courseId, rows.map((r) => ({ skill_id: r.skill_id, level: Number(r.level), objective_en: r.objective_en, objective_ar: r.objective_ar }))), { success: t('m04.fst.links.saved') }); }} />
    </div>
  );
}

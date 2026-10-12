// /knowledge/lectures (M24 · FS44, staff: knowledge R): the expert lecture library. Recorded expert talks (synthetic metadata, OECD-NEA
// Plan 2035 INSPIRE pattern), each linked to skills and to the KLRA position it protects, filterable by skill, system family and format.
// "Mine" lists my own lectures (drafts and submissions included) and my contributions: a delivered lecture or a published knowledge asset
// counts as skill evidence only after the knowledge-management owner validates it (rating, validated, level 3 for a speaker or SME).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Async, EmptyState, Tabs, Callout, StatTile, BenchmarkChips, Icon, WhyThis, DataTable } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { LECTURE_FAMILIES, LECTURE_FORMATS, contributionReasons, evidenceSkills, librarySummary } from './lectures';
import { ContribPill, LectureCard, LectureForm, LecturePill, LibrarySources, type Row } from './fs44ui';
import { useKcLabels, useKcRefs, type KcRefs } from './ui';

export function useLectures(personId: string | null) {
  const repo = useRepo();
  return useQuery(['lectures', 'contributions'], async () => {
    const [lectures, mine] = await Promise.all([
      (repo.list('lectures' as never, { order: [['delivered_on', 'desc']] } as never) as Promise<Row[]>).catch(() => [] as Row[]),
      personId ? (repo.list('contributions' as never, { filter: { person_id: personId } } as never) as Promise<Row[]>).catch(() => [] as Row[]) : Promise.resolve([] as Row[]),
    ]);
    return { lectures, mine };
  }, [personId]);
}

export default function LecturesPage() {
  const t = useT();
  const s = useSession();
  const refs = useKcRefs();
  const q = useLectures(s.identity.personId);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const tab = params.get('tab') === 'mine' ? 'mine' : 'library';
  return (
    <Page title={t('m24.routes.knowledge-lectures.title')} intro={t('m24.lc.intro')} wide eyebrow={<BenchmarkChips feature="FS44" />}
      actions={<span className="flex flex-wrap gap-2">
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="m24-lc-new"><Icon name="plus" size={14} /> {t('m24.lc.new')}</button>
        {s.can('knowledge', ['A']) && <L to="/knowledge/contributions" className="btn-outline btn-sm no-underline" data-testid="m24-lc-to-review">{t('m24.lc.toReview')}</L>}
        <L to="/knowledge" className="btn-ghost btn-sm no-underline">{t('m24.lc.toKb')}</L>
      </span>}>
      <Async state={refs}>
        {(r) => (
          <Async state={q} isEmpty={() => false}>
            {(d) => (
              <>
                <Tabs value={tab} onChange={(id) => setParams(id === 'mine' ? { tab: 'mine' } : {}, { replace: true })} tabs={[
                  { id: 'library', label: t('m24.lc.tabLibrary'), content: <Library refs={r} lectures={d.lectures.filter((l) => l.status === 'published')} /> },
                  { id: 'mine', label: t('m24.lc.tabMine'), content: <Mine refs={r} lectures={d.lectures.filter((l) => l.speaker_id === s.identity.personId || l.created_by === s.identity.personId)} contributions={d.mine} onNew={() => setOpen(true)} /> },
                ]} />
                {open && <LectureForm open={open} onClose={() => setOpen(false)} refs={r} onSaved={() => { q.reload?.(); setParams({ tab: 'mine' }, { replace: true }); }} />}
              </>
            )}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Library({ refs, lectures }: { refs: KcRefs; lectures: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [text, setText] = useState('');
  const [skill, setSkill] = useState('');
  const [family, setFamily] = useState('');
  const [format, setFormat] = useState('');
  const sum = librarySummary(lectures as never);
  const skillOpts = useMemo(() => refs.safeSkills.filter((k) => lectures.some((l) => (l.skill_ids ?? []).includes(k.id))), [refs, lectures]);
  const needle = text.trim().toLowerCase();
  const shown = lectures.filter((l) => (!skill || (l.skill_ids ?? []).includes(skill)) && (!family || l.system_family === family) && (!format || l.format === format)
    && (!needle || [l.title_en, l.title_ar, l.abstract_en, l.abstract_ar, l.speaker_name, l.speaker_name_ar].some((x) => String(x ?? '').toLowerCase().includes(needle))));
  return (
    <div className="space-y-5 pt-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" data-testid="m24-lc-tiles">
        <StatTile label={t('m24.lc.tile.lectures')} value={f.num(sum.lectures)} />
        <StatTile label={t('m24.lc.tile.hours')} value={f.num(sum.hours, { maximumFractionDigits: 1 })} sub={t('m24.lc.tile.hoursSub')} />
        <StatTile label={t('m24.lc.tile.speakers')} value={f.num(sum.speakers)} />
        <StatTile label={t('m24.lc.tile.protecting')} value={f.num(sum.protecting)} sub={t('m24.lc.tile.protectingSub')} tone="info" />
        <StatTile label={t('m24.lc.tile.skills')} value={f.num(sum.skills)} />
      </div>
      <Callout tone="sim" title={t('m24.lc.synthetic.title')}><span data-testid="m24-lc-synthetic">{t('m24.lc.synthetic.body')}</span></Callout>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[220px] flex-[2]"><span className="caps">{t('common.search')}</span><input className="input mt-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('m24.lc.searchHint')} data-testid="m24-lc-search" /></label>
        <label className="block min-w-[180px] flex-1"><span className="caps">{t('m24.kb.skill')}</span><select className="input mt-1" value={skill} onChange={(e) => setSkill(e.target.value)} data-testid="m24-lc-skill"><option value="">{t('m24.common.all')}</option>{skillOpts.map((k) => <option key={k.id} value={k.id}>{pick(k, 'name')}</option>)}</select></label>
        <label className="block min-w-[160px] flex-1"><span className="caps">{t('m24.kb.family')}</span><select className="input mt-1" value={family} onChange={(e) => setFamily(e.target.value)} data-testid="m24-lc-family"><option value="">{t('m24.common.all')}</option>{LECTURE_FAMILIES.map((x) => <option key={x} value={x}>{t(`m24.family.${x}`)}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('m24.lc.form.format')}>
        {(['', ...LECTURE_FORMATS] as string[]).map((k) => <button key={k || 'all'} className={`chip ${format === k ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-sunken text-ink-2'}`} aria-pressed={format === k} onClick={() => setFormat(k)} data-testid={`m24-lc-format-${k || 'all'}`}>{k ? t(`m24.lc.format.${k}`) : t('m24.common.all')}</button>)}
      </div>
      {shown.length === 0 ? <EmptyState icon="book" title={t('m24.lc.none')}>{t('m24.lc.noneBody')}</EmptyState> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m24-lc-list">
          {shown.map((l) => <LectureCard key={l.id} l={l} refs={refs} />)}
        </ul>
      )}
      <LibrarySources />
    </div>
  );
}

function Mine({ refs, lectures, contributions, onNew }: { refs: KcRefs; lectures: Row[]; contributions: Row[]; onNew: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useKcLabels(refs);
  // safeSkills already leaves out security skills and security competencies, so no extra competency set is needed here
  const skills = useMemo(() => new Map(refs.safeSkills.map((k) => [k.id, { id: k.id, area: k.area, competency_id: k.competency_id, lifecycle: k.lifecycle ?? null, fs_area: k.fs_area ?? null }])), [refs]);
  const sec = useMemo(() => new Set<string>(), []);
  const validated = contributions.filter((c) => c.status === 'validated');
  return (
    <div className="space-y-5 pt-4">
      <Callout title={t('m24.lc.mine.howTitle')}><span data-testid="m24-lc-how">{t('m24.lc.mine.howBody')}</span></Callout>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label={t('m24.lc.mine.lectures')} value={f.num(lectures.length)} />
        <StatTile label={t('m24.lc.mine.pending')} value={f.num(contributions.filter((c) => c.status === 'pending').length)} tone="sim" />
        <StatTile label={t('m24.lc.mine.validated')} value={f.num(validated.length)} tone="ok" />
        <StatTile label={t('m24.lc.mine.evidence')} value={f.num(validated.reduce((a, c) => a + (c.evidence_ids ?? []).length, 0))} sub={t('m24.lc.mine.evidenceSub')} />
      </div>
      <section aria-labelledby="m24-lc-mine-lec">
        <h2 id="m24-lc-mine-lec" className="caps mb-2">{t('m24.lc.mine.myLectures')}</h2>
        {lectures.length === 0 ? <EmptyState icon="book" title={t('m24.lc.mine.noLectures')} action={<button className="btn-primary btn-sm" onClick={onNew}>{t('m24.lc.new')}</button>}>{t('m24.lc.mine.noLecturesBody')}</EmptyState> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m24-lc-mine-list">
            {lectures.map((l) => <LectureCard key={l.id} l={l} refs={refs} extra={<div className="mt-auto flex items-center gap-2"><LecturePill status={l.status} />{l.status === 'review' && <span className="text-[12px] text-ink-3">{t('m24.lc.mine.waiting')}</span>}</div>} />)}
          </ul>
        )}
      </section>
      <section aria-labelledby="m24-lc-mine-ctb">
        <h2 id="m24-lc-mine-ctb" className="caps mb-2">{t('m24.lc.mine.myContributions')}</h2>
        {contributions.length === 0 ? <EmptyState icon="sparkle" title={t('m24.lc.mine.noContributions')}>{t('m24.lc.mine.noContributionsBody')}</EmptyState> : (
          <div data-testid="m24-lc-mine-ctb">
            <DataTable rows={contributions} rowKey={(c) => c.id} searchable={false} csvName="my-contributions" columns={[
              { key: 'title', header: t('m24.lc.col.source'), value: (c) => pick(c, 'title'), render: (c) => <span><span className="me-2 text-ink-3">{t(`m24.lc.kind.${c.kind}`)}</span>{c.kind === 'lecture' ? <L to={`/knowledge/lectures/${c.ref_id}`} className="link">{pick(c, 'title')}</L> : <L to={`/knowledge/assets/${c.ref_id}`} className="link">{pick(c, 'title')}</L>}</span> },
              { key: 'role', header: t('m24.lc.col.role'), value: (c) => t(`m24.lc.role.${c.contributor_role}`) },
              { key: 'skills', header: t('m24.lc.col.skills'), value: (c) => (c.skill_ids ?? []).map(lab.skill).join(', '), render: (c) => <span className="text-[12.5px]">{(c.skill_ids ?? []).map(lab.skill).join(' · ')}</span> },
              { key: 'level', header: t('m24.lc.col.level'), value: (c) => Number(c.level), align: 'center' },
              { key: 'status', header: t('m24.lc.col.status'), value: (c) => c.status, render: (c) => <span data-testid="m24-lc-mine-status" data-status={c.status}><ContribPill status={c.status} /></span> },
              { key: 'why', header: '', csv: false, render: (c) => <WhyThis testId="m24-lc-mine-why" reasons={contributionReasons(c as never, evidenceSkills(c.skill_ids ?? [], skills, sec).length, false) as never} /> },
            ]} />
          </div>
        )}
      </section>
    </div>
  );
}

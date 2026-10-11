// FS02 (future skills, wave A) · /admin/frameworks?tab=skills: the skills catalogue with its taxonomy attributes
// (reusability, type, lifecycle, decay class, owner, version, review date, level essence, alternative labels, Jahiz group,
// sources and benchmarks). Framework owners (frameworks W/A) change a skill's lifecycle; "obsolete, never delete" (ESCO)
// is enforced by skillGuard() here, the LocalBackend guard and the SQL trigger kafaa_fs_skill_guard. Mounted by
// m16/AdminFrameworksPage. Strings: src/i18n/fs.*.json (admin.sk.*, taxonomy labels).
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../../data';
import { useSession } from '../../../auth/session';
import { useFormat, usePick, useT } from '../../../i18n';
import {
  Async, BarChart, BenchmarkChip, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, Donut, Drawer, EmptyState, FilterBar, Modal, SelectField, SourceLink, StatTile, StatusPill,
  useFilters, type Column, type PillTone,
} from '../../../ui';
import type { SkillsRow, CompetenciesRow } from '../../../data/types';
import { todayIso } from '../../../domain/rules';
import {
  DECAY_HALF_LIFE_MONTHS, FS_AREAS, FUTURE_GROUPS, LIFECYCLES, SKILL_GUARD_MSG, publishProblems, reviewState, skillGuard, type DecayClass,
} from '../../../domain/taxonomy';

const LIFE_TONE: Record<string, PillTone> = { emerging: 'info', growing: 'ok', stable: 'neutral', declining: 'sim', obsolete: 'bad' };
const REVIEW_TONE: Record<string, PillTone> = { none: 'neutral', ok: 'neutral', due_soon: 'sim', overdue: 'bad' };
type Src = { id?: string; label?: string; url?: string };
const sourcesOf = (s: SkillsRow): Src[] => (Array.isArray(s.sources) ? (s.sources as Src[]) : []);

export default function SkillCatalogueTab() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const canEdit = s.can('frameworks', ['W', 'A']);
  const q = useQuery(['skills', 'competencies'], async () => {
    const [skills, comps] = await Promise.all([repo.list('skills', { order: [['sort', 'asc']] }), repo.list('competencies', { order: [['code', 'asc']] })]);
    return { skills, comps };
  });
  return (
    <Async state={q} isEmpty={(d) => d.skills.length === 0} empty={<EmptyState title={t('fs.admin.sk.empty')} />}>
      {(d) => <Catalogue skills={d.skills} comps={d.comps} canEdit={canEdit} />}
    </Async>
  );
}

function Catalogue({ skills, comps, canEdit }: { skills: SkillsRow[]; comps: CompetenciesRow[]; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const today = todayIso();
  const [flt, setFlt] = useFilters({ sq: '', sarea: '', slife: '', sgroup: '' }, true);
  const [open, setOpen] = useState<SkillsRow | null>(null);
  const future = skills.filter((x) => x.fs_area);
  const complete = skills.filter((x) => publishProblems(x).filter((p) => p !== 'obsolete').length === 0).length;
  const review = skills.map((x) => reviewState(x.review_due, today));
  const shown = useMemo(() => {
    const term = flt.sq.trim().toLowerCase();
    return skills.filter((x) => (!flt.sarea || (flt.sarea === 'none' ? !x.fs_area : x.fs_area === flt.sarea)) && (!flt.slife || x.lifecycle === flt.slife) && (!flt.sgroup || x.future_group === flt.sgroup)
      && (!term || [x.code, x.name_en, x.name_ar, ...(x.alt_labels_en ?? []), ...(x.alt_labels_ar ?? [])].join(' ').toLowerCase().includes(term)));
  }, [skills, flt]);
  const cols: Column<SkillsRow>[] = [
    { key: 'skill', header: t('fs.admin.sk.colSkill'), value: (x) => pick(x, 'name'), sortable: true, render: (x) => (
      <button type="button" className="text-start" onClick={() => setOpen(x)} data-testid={`fs-sk-open-${x.id}`}>
        <span className="font-semibold text-eyebrow hover:underline">{pick(x, 'name')}</span>
        <span className="mt-0.5 block text-[11.5px] text-ink-3"><bdi dir="ltr">{x.code}</bdi></span>
      </button>
    ) },
    { key: 'area', header: t('fs.admin.sk.colArea'), value: (x) => t(`fs.area.${x.fs_area ?? 'none'}`), render: (x) => <span className="text-[12.5px] text-ink-2">{t(`fs.area.${x.fs_area ?? 'none'}`)}</span> },
    { key: 'reusability', header: t('fs.admin.sk.colReusability'), value: (x) => t(`fs.reusability.${x.reusability}`) },
    { key: 'type', header: t('fs.admin.sk.colType'), value: (x) => t(`fs.skillType.${x.skill_type}`) },
    { key: 'lifecycle', header: t('fs.admin.sk.colLifecycle'), value: (x) => x.lifecycle, sortable: true, render: (x) => <StatusPill tone={LIFE_TONE[x.lifecycle]}>{t(`fs.lifecycle.${x.lifecycle}`)}</StatusPill> },
    { key: 'decay', header: t('fs.admin.sk.colDecay'), value: (x) => t(`fs.decayShort.${x.decay_class}`) },
    { key: 'owner', header: t('fs.admin.sk.colOwner'), value: (x) => t(`fs.owner.${x.owner_role}`), sortable: true },
    { key: 'version', header: t('fs.admin.sk.colVersion'), value: (x) => x.version, align: 'end', render: (x) => <span className="num">{f.num(x.version)}</span> },
    { key: 'review', header: t('fs.admin.sk.colReview'), value: (x) => x.review_due ?? '', sortable: true, render: (x) => {
      const st = reviewState(x.review_due, today);
      return <span className="flex flex-col items-start gap-0.5 whitespace-nowrap"><span>{f.date(x.review_due)}</span>{st !== 'ok' && <StatusPill tone={REVIEW_TONE[st]}>{t(`fs.review.${st}`)}</StatusPill>}</span>;
    } },
    { key: 'benchmarks', header: t('fs.admin.sk.colBenchmarks'), value: (x) => (x.benchmark_ids ?? []).join(' '), csv: true, render: (x) => <span className="flex flex-wrap gap-1">{(x.benchmark_ids ?? []).slice(0, 2).map((id) => <BenchmarkChip key={id} id={id} />)}</span> },
    { key: 'publish', header: t('fs.admin.sk.colPublish'), value: (x) => publishProblems(x).join(' ') || 'ready', render: (x) => {
      const p = publishProblems(x);
      return p.length ? <span className="text-[12px] text-ink-3">{p.map((c) => t(`fs.problems.skill.${c}`)).join(' · ')}</span> : <StatusPill tone="ok">{t('fs.admin.sk.yes')}</StatusPill>;
    } },
  ];
  return (
    <div className="space-y-4" data-testid="fs-admin-skills">
      <div className="space-y-2">
        <p className="max-w-3xl text-ink-2">{t('fs.admin.sk.intro')}</p>
        <BenchmarkChips feature="FS02" />
        {!canEdit && <p className="text-[12.5px] text-ink-3">{t('fs.admin.sk.readOnly')}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('fs.admin.sk.total')} value={f.num(skills.length)} sub={t('fs.admin.sk.neverDeleted')} />
        <StatTile label={t('fs.admin.sk.futureTile')} value={f.num(future.length)} sub={t('fs.admin.sk.futureSub', { n: f.num(new Set(future.map((x) => x.fs_area)).size) })} tone="info" />
        <StatTile label={t('fs.admin.sk.sourcedTile')} value={f.pct((complete / Math.max(1, skills.length)) * 100, 0)} sub={t('fs.admin.sk.sourcedSub')} tone={complete === skills.length ? 'ok' : 'bad'} />
        <StatTile label={t('fs.admin.sk.reviewTile')} value={f.num(review.filter((r) => r === 'overdue' || r === 'due_soon').length)} sub={t('fs.admin.sk.reviewSub', { overdue: f.num(review.filter((r) => r === 'overdue').length), soon: f.num(review.filter((r) => r === 'due_soon').length) })} tone={review.includes('overdue') ? 'bad' : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('fs.admin.sk.byGroup')}>
          <Donut title={t('fs.admin.sk.byGroup')} data={FUTURE_GROUPS.map((g) => ({ label: t(`fs.group.${g}`), value: skills.filter((x) => x.future_group === g).length }))} center={<span className="num text-[18px] font-semibold">{f.num(skills.length)}</span>} />
        </Card>
        <Card title={t('fs.admin.sk.byLifecycle')}>
          <BarChart title={t('fs.admin.sk.byLifecycle')} data={LIFECYCLES.map((l) => ({ label: t(`fs.lifecycle.${l}`), value: skills.filter((x) => x.lifecycle === l).length, tone: l === 'obsolete' ? 'bad' : l === 'declining' ? 'sim' : l === 'growing' ? 'leaf' : l === 'emerging' ? 'sky' : 'ink' }))} />
        </Card>
        <Card title={t('fs.admin.sk.byArea')}>
          <BarChart title={t('fs.admin.sk.byArea')} data={FS_AREAS.map((a) => ({ label: t(`fs.area.${a}`), value: future.filter((x) => x.fs_area === a).length }))} />
        </Card>
      </div>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="sq"
        fields={[
          { key: 'sarea', label: t('fs.admin.sk.colArea'), options: [...FS_AREAS, 'none'].map((a) => ({ value: a, label: t(`fs.area.${a}`) })) },
          { key: 'slife', label: t('fs.admin.sk.colLifecycle'), options: LIFECYCLES.map((l) => ({ value: l, label: t(`fs.lifecycle.${l}`) })) },
          { key: 'sgroup', label: t('fs.admin.sk.group'), options: FUTURE_GROUPS.map((g) => ({ value: g, label: t(`fs.group.${g}`) })) },
        ]}
      />
      {shown.length === 0 ? <EmptyState title={t('fs.admin.sk.empty')} /> : (
        <div data-testid="fs-sk-table"><DataTable rows={shown} rowKey={(x) => x.id} columns={cols} csvName="kafaa-skills-catalogue" searchable={false} /></div>
      )}
      {open && <SkillDrawer skill={skills.find((x) => x.id === open.id) ?? open} skills={skills} comps={comps} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SkillDrawer({ skill, skills, comps, canEdit, onClose }: { skill: SkillsRow; skills: SkillsRow[]; comps: CompetenciesRow[]; canEdit: boolean; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [change, setChange] = useState(false);
  const comp = comps.find((c) => c.id === skill.competency_id);
  const repl = skill.replaced_by ? skills.find((x) => x.id === skill.replaced_by) : null;
  const decay = skill.decay_class as DecayClass;
  return (
    <Drawer
      open
      onClose={onClose}
      title={pick(skill, 'name')}
      footer={canEdit ? (
        <button type="button" className="btn-outline" onClick={() => setChange(true)} disabled={skill.lifecycle === 'obsolete'} title={skill.lifecycle === 'obsolete' ? t('fs.admin.sk.obsoleteFinal') : undefined} data-testid="fs-sk-lifecycle">
          {t('fs.admin.sk.lifecycleChange')}
        </button>
      ) : undefined}
    >
      <div className="space-y-4 text-[14px]" data-testid="fs-sk-drawer">
        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone={LIFE_TONE[skill.lifecycle]}>{t(`fs.lifecycle.${skill.lifecycle}`)}</StatusPill>
          <StatusPill tone="accent">{t(`fs.area.${skill.fs_area ?? 'none'}`)}</StatusPill>
          {skill.future_group && <StatusPill tone="neutral">{t(`fs.group.${skill.future_group}`)}</StatusPill>}
        </div>
        {skill.lifecycle === 'obsolete' && (
          <Callout tone="bad" title={t('fs.admin.sk.obsoleteSince', { date: f.date(skill.obsolete_on) })}>
            {repl ? <>{t('fs.admin.sk.replacedBy')}: <strong>{pick(repl, 'name')}</strong></> : t('fs.admin.sk.obsoleteFinal')}
          </Callout>
        )}
        <section>
          <h3 className="caps mb-1">{t('fs.admin.sk.description')}</h3>
          <p className="text-ink-2">{pick(skill, 'description')}</p>
        </section>
        <section className="rounded-card border border-line bg-sunken p-3">
          <h3 className="caps mb-1">{t('fs.admin.sk.essence', { n: f.num(skill.key_level) })}</h3>
          <p>{pick(skill, 'level_essence')}</p>
        </section>
        <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          <dt className="text-ink-3">{t('fs.admin.sk.code')}</dt>
          <dd><bdi dir="ltr">{skill.code}</bdi></dd>
          <dt className="text-ink-3">{t('fs.admin.sk.competency')}</dt>
          <dd>{comp ? `${comp.code} · ${pick(comp, 'name')}` : skill.competency_id}</dd>
          <dt className="text-ink-3">{t('fs.admin.sk.colReusability')}</dt>
          <dd>{t(`fs.reusability.${skill.reusability}`)}</dd>
          <dt className="text-ink-3">{t('fs.admin.sk.colType')}</dt>
          <dd>{t(`fs.skillType.${skill.skill_type}`)}</dd>
          <dt className="text-ink-3">{t('fs.admin.sk.halfLife')}</dt>
          <dd>{t(`fs.decay.${skill.decay_class}`)}<span className="sr-only"> {f.num(DECAY_HALF_LIFE_MONTHS[decay] ?? 36)}</span></dd>
          <dt className="text-ink-3">{t('fs.admin.sk.colOwner')}</dt>
          <dd>{t(`fs.owner.${skill.owner_role}`)}</dd>
          <dt className="text-ink-3">{t('fs.admin.sk.colVersion')}</dt>
          <dd className="num">{f.num(skill.version)}</dd>
          <dt className="text-ink-3">{t('fs.admin.sk.colReview')}</dt>
          <dd>{f.date(skill.review_due)}</dd>
          <dt className="text-ink-3">{t('fs.admin.sk.keyLevel')}</dt>
          <dd className="num">{f.num(skill.key_level)}</dd>
        </dl>
        {((skill.alt_labels_en ?? []).length > 0 || (skill.alt_labels_ar ?? []).length > 0) && (
          <section>
            <h3 className="caps mb-1">{t('fs.admin.sk.altLabels')}</h3>
            <div className="flex flex-wrap gap-1">
              {[...(skill.alt_labels_en ?? []).map((x) => ({ x, lang: 'en' })), ...(skill.alt_labels_ar ?? []).map((x) => ({ x, lang: 'ar' }))].map(({ x, lang }) => (
                <span key={`${lang}-${x}`} lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="chip border-line bg-panel text-ink-2">{x}</span>
              ))}
            </div>
          </section>
        )}
        <section>
          <h3 className="caps mb-1">{t('fs.admin.sk.sources')}</h3>
          <ul className="space-y-1">
            {sourcesOf(skill).filter((x) => x.url).map((x) => (
              <li key={x.url}><SourceLink href={x.url!}>{x.label ?? x.url}</SourceLink></li>
            ))}
          </ul>
        </section>
        {(skill.benchmark_ids ?? []).length > 0 && <BenchmarkChips ids={skill.benchmark_ids} />}
      </div>
      {change && <LifecycleModal skill={skill} skills={skills} onClose={() => setChange(false)} />}
    </Drawer>
  );
}

function LifecycleModal({ skill, skills, onClose }: { skill: SkillsRow; skills: SkillsRow[]; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [life, setLife] = useState<string>(skill.lifecycle);
  const [repl, setRepl] = useState<string>('');
  const [confirm, setConfirm] = useState(false);
  const next = { ...skill, lifecycle: life, obsolete_on: life === 'obsolete' ? todayIso() : null, replaced_by: life === 'obsolete' ? repl || null : null, version: skill.version + 1 };
  const blocked = skillGuard(skill, next as never);
  const unchanged = life === skill.lifecycle;
  return (
    <Modal
      open
      onClose={onClose}
      title={t('fs.admin.sk.lifecycleTitle', { name: pick(skill, 'name') })}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" disabled={unchanged || !!blocked} onClick={() => setConfirm(true)} data-testid="fs-sk-lifecycle-save">{t('common.save')}</button>
        </>
      }
    >
      <div className="space-y-3">
        <SelectField label={t('fs.admin.sk.newLifecycle')} name="fs-sk-life" value={life} onChange={setLife} options={LIFECYCLES.map((l) => ({ value: l, label: t(`fs.lifecycle.${l}`) }))} />
        {life === 'obsolete' && (
          <SelectField label={t('fs.admin.sk.replacement')} name="fs-sk-repl" value={repl} onChange={setRepl}
            options={[{ value: '', label: t('fs.admin.sk.noReplacement') }, ...skills.filter((x) => x.id !== skill.id && x.lifecycle !== 'obsolete').map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'name')}` }))]} />
        )}
        {blocked && blocked !== SKILL_GUARD_MSG.obsoleteDate && <Callout tone="bad">{blocked}</Callout>}
        <p className="text-[12.5px] text-ink-3">{t('fs.admin.sk.lifecycleConsequence')}</p>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('fs.admin.sk.lifecycleTitle', { name: pick(skill, 'name') })}
        consequence={t('fs.admin.sk.lifecycleConsequence')}
        danger={life === 'obsolete'}
        onConfirm={async () => {
          const r = await run(() => repo.update('skills', skill.id, { lifecycle: next.lifecycle as never, obsolete_on: next.obsolete_on, replaced_by: next.replaced_by, version: next.version }), { success: t('fs.admin.sk.lifecycleSaved') });
          if (r.ok) onClose();
        }}
      />
    </Modal>
  );
}

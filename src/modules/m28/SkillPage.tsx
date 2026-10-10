// FS07 /skills/:id · one skill (public): definition, the level essence at its key level and the generic level ladder (SFIA 9 style),
// lifecycle and taxonomy chips, the roles that need it now and at the 2030/2035 horizons (FS05 published role profiles), the courses,
// training paths and micro-credentials that build it, the crosswalk tab (FS08) and its sources with as-of dates. Obsolete skills stay
// reachable here with an "obsolete since" note and their replacement. Signed in: "You hold this at L2 (verified)" from the viewer's
// own passport and "Add to my goals" (rpc.setSkillGoal; hand-off to FS33).
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import {
  Async, BenchmarkChips, Callout, Card, EmptyState, KeyValue, Page, SelectField, SourceLink, StatusPill, Tabs,
} from '../../ui';
import { DECAY_HALF_LIFE_MONTHS, levelEssence, reviewState, type DecayClass } from '../../domain/taxonomy';
import { todayIso } from '../../domain/rules';
import type { PersonSkillsRow, SkillGoalsRow, SkillsRow } from '../../data/types';
import { TRAINING_PATHS } from '../m04/paths';
import { datedSources, learningFor, rolesForSkill, type PathRef } from './explorer';
import { CrosswalkList, LIFE_TONE, MatchLegend, useCatalogue, type Catalogue } from './ui';

const TABS = ['overview', 'roles', 'learning', 'crosswalk', 'sources'] as const;

export default function SkillPage() {
  const t = useT();
  const { id = '' } = useParams();
  const c = useCatalogue();
  return (
    <Async state={c}>
      {(d) => {
        const s = d.skills.find((x) => x.id === id);
        if (!s) return <Page title={t('m28.skill.notFound')}><EmptyState title={t('m28.skill.notFound')}><L to="/skills">{t('m28.skill.back')}</L></EmptyState></Page>;
        return <SkillView s={s} c={d} />;
      }}
    </Async>
  );
}

function useRelated(s: SkillsRow) {
  const repo = useRepo();
  return useQuery(['role_profile_versions', 'job_roles', 'courses', 'microcred_defs'], async () => {
    const [versions, roles, courses, creds] = await Promise.all([
      repo.list('role_profile_versions', { filter: { status: 'published' } }),
      repo.list('job_roles'),
      repo.list('courses'),
      repo.list('microcred_defs', { filter: { status: 'current' } }),
    ]);
    const paths: PathRef[] = TRAINING_PATHS.map((p) => ({ id: p.id, title: p.title, careerOnly: p.careerOnly, stages: p.stages.map((st) => ({ id: st.id, title: st.title, courses: st.courses, standards: st.standards })) }));
    return { roles: rolesForSkill(s, versions, roles), learning: learningFor(s, courses, paths, creds) };
  }, [s.id]);
}

function SkillView({ s, c }: { s: SkillsRow; c: Catalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [sp, setSp] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as string) : 'overview';
  const rel = useRelated(s);
  const repl = s.replaced_by ? c.skills.find((x) => x.id === s.replaced_by) : null;
  const rows = c.bySkill.get(s.id) ?? [];
  const nPub = rows.filter((r) => r.status === 'published').length;
  const sources = datedSources(s.sources, c.sources, c.benchmarks);
  const review = reviewState(s.review_due, todayIso());
  return (
    <Page
      title={pick(s, 'name')}
      eyebrow={<span><bdi dir="ltr">{s.code}</bdi> · {t(`m28.area.${s.area}`)}</span>}
      intro={pick(s, 'description')}
      wide
      actions={<L to="/skills" className="btn-outline">{t('m28.skill.back')}</L>}
    >
      <div className="flex flex-wrap items-center gap-1.5" data-testid="m28-skill-chips">
        <StatusPill tone={LIFE_TONE[s.lifecycle]}>{t(`fs.lifecycle.${s.lifecycle}`)}</StatusPill>
        {s.fs_area && <span className="chip border-accent/40 bg-accent-soft text-eyebrow">{t(`fs.area.${s.fs_area}`)}</span>}
        <span className="chip border-line bg-panel text-ink-2">{t(`fs.reusability.${s.reusability}`)}</span>
        <span className="chip border-line bg-panel text-ink-2">{t(`fs.skillType.${s.skill_type}`)}</span>
        <span className="chip border-line bg-panel text-ink-2">{t(`fs.decay.${s.decay_class}`)}</span>
        {s.future_group && <span className="chip border-line bg-panel text-ink-2">{t(`fs.group.${s.future_group}`)}</span>}
      </div>
      <div data-testid="m28-bench-fs07"><BenchmarkChips feature="FS07" /></div>
      {s.lifecycle === 'obsolete' && (
        <Callout tone="bad" title={t('m28.skill.obsoleteSince', { date: f.date(s.obsolete_on) })}>
          <span data-testid="m28-obsolete">{repl ? <>{t('m28.skill.replacedBy')} <L to={`/skills/${repl.id}`}>{pick(repl, 'name')}</L></> : t('m28.skill.noReplacement')}</span>
        </Callout>
      )}
      {s.fs_area === 'advanced_reactor' && <Callout tone="sim">{t('m28.skill.noDeployment')}</Callout>}
      <Mine s={s} />
      <AiTrack skillId={s.id} />
      <Tabs
        value={tab}
        onChange={(v) => { const n = new URLSearchParams(sp); n.set('tab', v); setSp(n, { replace: true }); }}
        tabs={[
          { id: 'overview', label: t('m28.skill.tab.overview'), content: <Overview s={s} /> },
          { id: 'roles', label: t('m28.skill.tab.roles'), content: <Async state={rel}>{(r) => <Roles r={r.roles} />}</Async> },
          { id: 'learning', label: t('m28.skill.tab.learning'), content: <Async state={rel}>{(r) => <Learning l={r.learning} />}</Async> },
          { id: 'crosswalk', label: t('m28.skill.tab.crosswalk'), badge: <span className="num">{f.num(nPub)}</span>, content: (
            <div className="space-y-3" data-testid="m28-skill-crosswalk">
              <div data-testid="m28-bench-fs08"><BenchmarkChips feature="FS08" /></div>
              <CrosswalkList rows={rows} fwById={c.fwById} />
              <MatchLegend />
              <L to="/skills/frameworks" className="text-[13px]">{t('m28.skill.allFrameworks')}</L>
            </div>
          ) },
          { id: 'sources', label: t('m28.skill.tab.sources'), content: (
            <div className="space-y-3">
              <ul className="space-y-1.5" data-testid="m28-skill-sources">
                {sources.map((x) => (
                  <li key={x.url}><SourceLink href={x.url} date={x.as_of ? t('m28.asOf', { date: f.date(x.as_of) }) : null}>{x.label}</SourceLink></li>
                ))}
              </ul>
              {(s.benchmark_ids ?? []).length > 0 && <BenchmarkChips ids={s.benchmark_ids} label={t('m28.skill.follows')} />}
              <KeyValue items={[
                [t('m28.skill.owner'), t(`fs.owner.${s.owner_role}`)],
                [t('m28.skill.version'), <span className="num">{f.num(s.version)}</span>],
                [t('m28.skill.review'), <span>{f.date(s.review_due)} {review !== 'ok' && <StatusPill tone={review === 'overdue' ? 'bad' : 'sim'}>{t(`fs.review.${review}`)}</StatusPill>}</span>],
              ]} />
            </div>
          ) },
        ]}
      />
    </Page>
  );
}

function Overview({ s }: { s: SkillsRow }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const name = { en: s.name_en, ar: s.name_ar };
  const alts = [...(s.alt_labels_en ?? []).map((x) => ({ x, lang: 'en' })), ...(s.alt_labels_ar ?? []).map((x) => ({ x, lang: 'ar' }))];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title={t('m28.skill.ladder')}>
        <ol className="space-y-2" data-testid="m28-ladder">
          {[1, 2, 3, 4].map((lv) => {
            const key = lv === s.key_level;
            const text = key && pick(s, 'level_essence') ? pick(s, 'level_essence') : levelEssence(lv, name)[lang];
            return (
              <li key={lv} className={`rounded-card border p-3 ${key ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`} data-testid={key ? 'm28-key-level' : undefined}>
                <p className="flex items-center gap-2 text-[12px]"><span className="num font-semibold">{t('m28.levels.level', { n: f.num(lv) })}</span><span className="caps">{t(`m28.levelName.${lv}`)}</span>{key && <StatusPill tone="accent">{t('m28.skill.keyLevel')}</StatusPill>}</p>
                <p className="mt-1 text-[13.5px]">{text}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[12px] text-ink-3">{t('m28.skill.ladderNote')}</p>
      </Card>
      <div className="space-y-4">
        <Card title={t('m28.skill.facts')}>
          <KeyValue items={[
            [t('m28.skill.area'), t(`m28.area.${s.area}`)],
            [t('m28.f.reuse'), t(`fs.reusability.${s.reusability}`)],
            [t('m28.skill.type'), t(`fs.skillType.${s.skill_type}`)],
            [t('m28.skill.halfLife'), t('m28.skill.halfLifeV', { n: f.num(DECAY_HALF_LIFE_MONTHS[s.decay_class as DecayClass] ?? 36) })],
            [t('m28.skill.owner'), t(`fs.owner.${s.owner_role}`)],
          ]} />
        </Card>
        {alts.length > 0 && (
          <Card title={t('m28.skill.altLabels')}>
            <div className="flex flex-wrap gap-1" data-testid="m28-alt-labels">
              {alts.map(({ x, lang }) => <span key={`${lang}-${x}`} lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="chip border-line bg-panel text-ink-2">{x}</span>)}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Roles({ r }: { r: ReturnType<typeof rolesForSkill> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <div className="space-y-3" data-testid="m28-skill-roles">
      <div className="grid gap-3 md:grid-cols-3">
        {(['now', '2030', '2035'] as const).map((h) => (
          <Card key={h} title={t(`m28.skill.h.${h}`)}>
            {r[h].length === 0 ? <p className="text-[13px] text-ink-3">{t('m28.skill.noRoles')}</p> : (
              <ul className="space-y-2" data-testid={`m28-roles-${h}`}>
                {r[h].slice(0, 12).map((x) => (
                  <li key={x.role.id} className="text-[13px]">
                    <L to={`/careers/roles/${x.role.id}${h === 'now' ? '' : '?tab=horizons'}`} className="font-medium">{pick(x.role, 'title')}</L>
                    {x.role.lifecycle === 'concept' && <span className="ms-1"><StatusPill tone="info">{t('m28.skill.concept')}</StatusPill></span>}
                    <span className="block text-[12px] text-ink-3">{t('m28.skill.needs', { n: f.num(x.level) })} · {t(`m28.importance.${x.importance}`)}{x.via === 'competency' ? ` · ${t('m28.skill.viaComp')}` : ''}</span>
                  </li>
                ))}
                {r[h].length > 12 && <li className="text-[12px] text-ink-3">{t('m28.skill.more', { n: f.num(r[h].length - 12) })}</li>}
              </ul>
            )}
          </Card>
        ))}
      </div>
      <p className="text-[12.5px] text-ink-3">{t('m28.skill.rolesNote')}</p>
    </div>
  );
}

function Learning({ l }: { l: ReturnType<typeof learningFor> }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const pick = usePick();
  const none = !l.courses.length && !l.paths.length && !l.credentials.length;
  if (none) return <EmptyState title={t('m28.skill.noLearning')}>{t('m28.skill.noLearningBody')}</EmptyState>;
  return (
    <div className="grid gap-3 md:grid-cols-3" data-testid="m28-skill-learning">
      <Card title={t('m28.skill.courses')}>
        {l.courses.length === 0 ? <p className="text-[13px] text-ink-3">—</p> : (
          <ul className="space-y-1.5 text-[13px]">
            {l.courses.slice(0, 10).map((x) => (
              <li key={x.course.id}><L to={`/learn/course/${x.course.id}`}>{pick(x.course, 'title')}</L>
                <span className="block text-[12px] text-ink-3"><bdi dir="ltr">{x.course.code}</bdi>{x.course.duration_hours ? ` · ${t('m28.skill.hours', { n: f.num(x.course.duration_hours) })}` : ''} · {t(`m28.skill.via.${x.via}`)}</span></li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t('m28.skill.paths')}>
        {l.paths.length === 0 ? <p className="text-[13px] text-ink-3">—</p> : (
          <ul className="space-y-1.5 text-[13px]">
            {l.paths.map((x) => <li key={x.path.id}><L to={`/learn/paths/${x.path.id}`}>{x.path.title[lang]}</L><span className="block text-[12px] text-ink-3">{x.stages.map((st) => st[lang]).join(' · ')}</span></li>)}
          </ul>
        )}
      </Card>
      <Card title={t('m28.skill.credentials')}>
        {l.credentials.length === 0 ? <p className="text-[13px] text-ink-3">—</p> : (
          <ul className="space-y-1.5 text-[13px]">
            {l.credentials.map((x) => <li key={x.cred.id}>{pick(x.cred, 'title')}<span className="block text-[12px] text-ink-3"><bdi dir="ltr">{x.cred.code}</bdi> · {t(`m28.skill.credVia.${x.via}`)}</span></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Signed-in overlay: my level from my passport, and my goal for this skill. Anonymous visitors load nothing personal. */
function Mine({ s }: { s: SkillsRow }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const session = useSession();
  const pid = session.identity.personId;
  const own = session.can('skills_profile', ['Own']);
  const q = useQuery(['person_skills', 'skill_goals'], async () => {
    if (!pid || !own) return null;
    const [ps, g] = await Promise.all([repo.list('person_skills', { filter: { person_id: pid, skill_id: s.id } }), repo.list('skill_goals', { filter: { person_id: pid, skill_id: s.id } })]);
    return { held: (ps as PersonSkillsRow[]).find((x) => x.active && x.level > 0) ?? null, goal: (g as SkillGoalsRow[]).find((x) => x.status === 'active') ?? null };
  }, [pid, own, s.id]);
  const [level, setLevel] = useState<string | null>(null);
  const restricted = s.area === 'security' || s.lifecycle === 'obsolete';
  const d = q.data;
  const target = useMemo(() => String(Math.min(4, Math.max(1, (d?.held?.level ?? 1) + 1))), [d?.held?.level]);
  if (!pid) return <p className="text-[13px] text-ink-3" data-testid="m28-mine-anon"><L to="/sign-in">{t('m28.mine.signIn')}</L></p>;
  if (!own || !d) return null;
  return (
    <div data-testid="m28-mine"><Card className="border-accent/40">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1" data-testid="m28-mine-held">
          {d.held ? (
            <p className="text-[14px]"><strong>{t('m28.mine.hold', { n: f.num(d.held.level), basis: t(`m28.basis.${d.held.basis}`) })}</strong>
              <span className="ms-2 text-[12.5px] text-ink-3">{t('m28.mine.band', { band: t(`m28.band.${d.held.confidence_band}`) })}</span></p>
          ) : <p className="text-[14px] text-ink-2">{t('m28.mine.notHeld')}</p>}
          <L to="/my/skills" className="text-[12.5px]">{t('m28.mine.passport')}</L>
        </div>
        {!restricted && (d.goal ? (
          <div className="flex items-center gap-2">
            <StatusPill tone="accent">{t('m28.mine.goal', { n: f.num(d.goal.target_level) })}</StatusPill>
            <button type="button" className="btn-outline" data-testid="m28-goal-remove" onClick={() => run(() => repo.rpc.setSkillGoal(s.id, d.goal!.target_level, false))}>{t('m28.mine.remove')}</button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <SelectField label={t('m28.mine.target')} name="m28-goal-level" value={level ?? target} onChange={setLevel}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: t('m28.levels.level', { n: f.num(n) }) }))} />
            <button type="button" className="btn-primary mb-1" data-testid="m28-goal-add" onClick={() => run(() => repo.rpc.setSkillGoal(s.id, Number(level ?? target), true))}>{t('m28.mine.add')}</button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-3">{restricted ? t(s.area === 'security' ? 'm28.mine.securityNote' : 'm28.mine.obsoleteNote') : t('m28.mine.goalNote')}</p>
    </Card></div>
  );
}


/** FS wave-B integration: FS09 tie. A skill on the AI fluency ladder links to the ladder (literacy: everyone; engineering:
 * specialists, never part of the literacy rung). Reads the public ai_skill_tracks rows. */
function AiTrack({ skillId }: { skillId: string }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery(['ai_skill_tracks'], () => repo.list('ai_skill_tracks', { filter: { skill_id: skillId } }).catch(() => []), [skillId]);
  const row = q.data?.[0];
  if (!row) return null;
  return (
    <div data-testid="m28-ai-track" data-track={row.track}>
      <Callout tone="info" title={t(`m28.wb.aiTitle.${row.track === 'engineering' ? 'engineering' : 'literacy'}`)}>
        {pick(row, 'rationale')}{' '}
        <L to="/learn/ai-fluency" data-testid="m28-to-ai-ladder">{t('m28.wb.aiLadder')}</L>
        {s.identity.personId && <>{' · '}<L to="/my/ai-fluency" data-testid="m28-to-my-ai">{t('m28.wb.aiMine')}</L></>}
      </Callout>
    </div>
  );
}

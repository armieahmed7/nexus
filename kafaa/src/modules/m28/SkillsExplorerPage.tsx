// FS07 /skills · Skills Catalogue Explorer (public). Every published skill (obsolete ones hidden, reachable by link) with filters for
// area, reusability, lifecycle, Jahiz group and future-skills area, and one search box over EN and AR names, alternative labels,
// codes and crosswalk labels (Arabic normalised). Each hit explains why it matched (<WhyThis>). Signed in: "you hold this at L2"
// from the viewer's own passport and the goals they keep. Anonymous visitors load no person data.
import { useMemo } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, BenchmarkChips, Card, EmptyState, En, FilterBar, Icon, Page, StatTile, StatusPill, WhyThis, useFilters } from '../../ui';
import { FUTURE_GROUPS, FS_AREAS, LIFECYCLES, REUSABILITY } from '../../domain/taxonomy';
import type { PersonSkillsRow, SkillGoalsRow, SkillsRow } from '../../data/types';
import { filterSkills, isListed, searchSkills } from './explorer';
import { CatalogueGaps, LIFE_TONE, useCatalogue, type Catalogue } from './ui';

const AREAS = ['plant_systems', 'operations', 'maintenance', 'radiation_chemistry', 'engineering', 'safety', 'human_performance', 'emergency', 'security', 'quality', 'leadership', 'digital', 'project'];

export default function SkillsExplorerPage() {
  const t = useT();
  const c = useCatalogue();
  return (
    <Page
      title={t('m28.routes.skills.title')}
      eyebrow={t('m28.explorer.eyebrow')}
      intro={t('m28.explorer.intro')}
      wide
      actions={<L to="/skills/frameworks" className="btn-outline" data-testid="m28-to-frameworks">{t('m28.explorer.toFrameworks')}</L>}
    >
      <div data-testid="m28-bench-fs07"><BenchmarkChips feature="FS07" /></div>
      <Async state={c} isEmpty={(d) => d.skills.length === 0} empty={<EmptyState title={t('m28.explorer.empty')} />}>
        {(d) => <><CatalogueGaps c={d} onRetry={c.reload} /><Explorer c={d} /></>}
      </Async>
    </Page>
  );
}

function useMine() {
  const repo = useRepo();
  const s = useSession();
  const pid = s.identity.personId;
  const own = s.can('skills_profile', ['Own']);
  return useQuery(['person_skills', 'skill_goals'], async () => {
    if (!pid || !own) return { held: new Map<string, PersonSkillsRow>(), goals: new Map<string, SkillGoalsRow>() };
    const [ps, goals] = await Promise.all([repo.list('person_skills', { filter: { person_id: pid } }), repo.list('skill_goals', { filter: { person_id: pid } })]);
    return { held: new Map(ps.filter((x) => x.active && x.level > 0).map((x) => [x.skill_id, x])), goals: new Map(goals.filter((g) => g.status === 'active').map((g) => [g.skill_id, g])) };
  }, [pid, own]);
}

function Explorer({ c }: { c: Catalogue }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const mine = useMine();
  const [flt, setFlt] = useFilters({ q: '', area: '', reuse: '', life: '', group: '', future: '' }, true);
  const listed = useMemo(() => c.skills.filter(isListed), [c.skills]);
  const obsolete = c.skills.filter((s) => s.lifecycle === 'obsolete');
  const filtered = filterSkills(listed, { area: flt.area, reusability: flt.reuse, lifecycle: flt.life, group: flt.group, future: flt.future });
  const hits = useMemo(() => searchSkills(filtered, flt.q, c.labels), [filtered, flt.q, c.labels]);
  const aligned = listed.filter((s) => (c.bySkill.get(s.id) ?? []).some((a) => a.status === 'published')).length;
  const future = listed.filter((s) => s.fs_area).length;
  const held = mine.data?.held;
  const goals = mine.data?.goals;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m28-explorer-tiles">
        <StatTile label={t('m28.explorer.tPublished')} value={f.num(listed.length)} sub={t('m28.explorer.tPublishedSub', { n: f.num(obsolete.length) })} />
        <StatTile label={t('m28.explorer.tFuture')} value={f.num(future)} sub={t('m28.explorer.tFutureSub', { n: f.num(FS_AREAS.length) })} tone="info" />
        <StatTile label={t('m28.explorer.tAligned')} value={f.pct((aligned / Math.max(1, listed.length)) * 100, 0)} sub={t('m28.explorer.tAlignedSub', { n: f.num(c.frameworks.length) })} tone="ok" />
        <StatTile label={t('m28.explorer.tMine')} value={held ? f.num(held.size) : '—'} sub={held ? t('m28.explorer.tMineSub', { n: f.num(goals?.size ?? 0) }) : t('m28.explorer.tMineAnon')} />
      </div>

      <div className="card space-y-3" role="search">
        <label htmlFor="m28-q" className="caps block">{t('m28.explorer.searchLabel')}</label>
        <div className="flex items-center gap-2 rounded-card border border-line bg-panel px-3 py-2 focus-within:ring-2 focus-within:ring-accent">
          <Icon name="search" size={16} />
          <input id="m28-q" type="search" value={flt.q} onChange={(e) => setFlt({ q: e.target.value })} placeholder={t('m28.explorer.searchPh')}
            className="w-full bg-transparent text-[15px] outline-none" data-testid="m28-search" autoComplete="off" />
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label={t('m28.explorer.tryLabel')}>
          <span className="text-[12px] text-ink-3">{t('m28.explorer.tryLabel')}</span>
          {['تحليل البيانات', 'systems thinking', 'AI', 'ESCO', 'SMR'].map((x) => (
            <button key={x} type="button" className="chip border-line bg-sunken text-ink-2 hover:border-accent" onClick={() => setFlt({ q: x })}><bdi>{x}</bdi></button>
          ))}
        </div>
        <FilterBar
          value={flt}
          onChange={setFlt}
          fields={[
            { key: 'area', label: t('m28.f.area'), options: AREAS.map((a) => ({ value: a, label: t(`m28.area.${a}`) })) },
            { key: 'reuse', label: t('m28.f.reuse'), options: REUSABILITY.map((r) => ({ value: r, label: t(`fs.reusability.${r}`) })) },
            { key: 'life', label: t('m28.f.life'), options: LIFECYCLES.filter((l) => l !== 'obsolete').map((l) => ({ value: l, label: t(`fs.lifecycle.${l}`) })) },
            { key: 'group', label: t('m28.f.group'), options: FUTURE_GROUPS.map((g) => ({ value: g, label: t(`fs.group.${g}`) })) },
            { key: 'future', label: t('m28.f.future'), options: [{ value: 'any', label: t('m28.f.futureAny') }, { value: 'established', label: t('fs.area.none') }, ...FS_AREAS.map((a) => ({ value: a, label: t(`fs.area.${a}`) }))] },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-ink-2" aria-live="polite" data-testid="m28-count">{t('m28.explorer.count', { n: f.num(hits.length), total: f.num(listed.length) })}</p>
        {obsolete.length > 0 && (
          <p className="text-[12.5px] text-ink-3" data-testid="m28-obsolete-note">
            {t('m28.explorer.obsoleteHidden', { n: f.num(obsolete.length) })} {obsolete.map((o) => <L key={o.id} to={`/skills/${o.id}`} className="ms-1">{pick(o, 'name')}</L>)}
          </p>
        )}
      </div>

      {hits.length === 0 ? (
        <EmptyState title={t('m28.explorer.noHits')}>{t('m28.explorer.noHitsBody')}</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m28-skill-list">
          {hits.map((h) => <SkillCard key={h.id} s={h.item} c={c} reasons={flt.q ? h.reasons : []} held={held?.get(h.id)} goal={!!goals?.get(h.id)} />)}
        </ul>
      )}
    </>
  );
}

function SkillCard({ s, c, reasons, held, goal }: { s: SkillsRow; c: Catalogue; reasons: Parameters<typeof WhyThis>[0]['reasons']; held?: PersonSkillsRow; goal: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const fws = [...new Set((c.bySkill.get(s.id) ?? []).filter((a) => a.status === 'published').map((a) => a.framework))];
  return (
    <Card as="li" className="flex flex-col" padded>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <L to={`/skills/${s.id}`} className="text-[15px] font-semibold text-eyebrow hover:underline" data-testid={`m28-skill-${s.id}`}>{pick(s, 'name')}</L>
          <p className="mt-0.5 text-[11.5px] text-ink-3"><bdi dir="ltr">{s.code}</bdi> · {t(`m28.area.${s.area}`)}</p>
        </div>
        <StatusPill tone={LIFE_TONE[s.lifecycle]}>{t(`fs.lifecycle.${s.lifecycle}`)}</StatusPill>
      </div>
      <p className="mt-2 line-clamp-3 text-[13px] text-ink-2">{pick(s, 'level_essence')}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {s.fs_area && <span className="chip border-accent/40 bg-accent-soft text-eyebrow">{t(`fs.area.${s.fs_area}`)}</span>}
        <span className="chip border-line bg-panel text-ink-2">{t(`fs.reusability.${s.reusability}`)}</span>
        {s.future_group && <span className="chip border-line bg-panel text-ink-2">{t(`fs.group.${s.future_group}`)}</span>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[12px]">
        <span className="text-ink-3" data-testid="m28-card-fw">{t('m28.explorer.mapsTo', { n: f.num(fws.length) })}</span>
        {fws.slice(0, 4).map((x) => <span key={x} className="chip border-line bg-sunken text-ink-2"><En>{c.fwById.get(x)?.short ?? x}</En></span>)}
        {held && <span data-testid="m28-card-held"><StatusPill tone="ok">{t('m28.mine.holdShort', { n: f.num(held.level) })}</StatusPill></span>}
        {goal && <StatusPill tone="accent">{t('m28.mine.onGoals')}</StatusPill>}
        {reasons.length > 0 && <span className="ms-auto"><WhyThis reasons={reasons} testId={`m28-why-${s.id}`} /></span>}
      </div>
    </Card>
  );
}

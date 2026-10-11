// FS17 /learn/pathways (staff, internal_content R): a pathway per FS02 future skill and level (L1-L3), each with its 3-6 month
// envelope, weekly hour cost, how long colleagues took (suppressed under 10) and steps that resolve at run time ("requested" steps feed
// the training gap backlog). Grouped by future-skills area, filterable, with my status and the Coach's top picks for me.
import { useMemo } from 'react';
import { Page, Section, Async, EmptyState, StatTile, BenchmarkChips, FilterBar, useFilters, Icon, StatusPill, Callout } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { CoachPathwayCard, EnvelopeLine, LevelPill, PeerLine, useFsCoach, usePwRef, type PwRef, type Row } from './fsui';
import type { PathwaySummary } from './backend/rpc';

export const FS_AREAS = ['transversal', 'ai_data', 'digital_plant', 'cyber_hygiene', 'green_energy', 'advanced_reactor'];

export default function PathwaysPage() {
  const t = useT();
  const ref = usePwRef();
  return (
    <Page title={t('m19.routes.learn-pathways.title')} intro={t('m19.pw.cat.intro')} wide eyebrow={<BenchmarkChips feature="FS17" />}
      actions={<span className="flex flex-wrap gap-2">
        <L to="/my/pathways" className="btn-primary btn-sm no-underline" data-testid="m19-pw-to-mine"><Icon name="user" size={14} /> {t('m19.pw.cat.toMine')}</L>
        <L to="/learn/external" className="btn-outline btn-sm no-underline" data-testid="m19-pw-to-external"><Icon name="external" size={14} /> {t('m19.pw.cat.toExternal')}</L>
      </span>}>
      <Async state={ref} isEmpty={(d) => !d.catalogue} empty={<EmptyState title={t('m19.pw.cat.none')}>{t('m19.pw.cat.noneBody')}</EmptyState>}>{(d) => <Catalogue d={d} />}</Async>
    </Page>
  );
}

function Catalogue({ d }: { d: PwRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [flt, setFlt] = useFilters({ area: '', level: '', status: '', q: '' }, true);
  const cat = d.catalogue!;
  const skills = useMemo(() => new Map(d.skills.map((s) => [s.id, s])), [d.skills]);
  const byId = useMemo(() => new Map(d.pathways.map((p) => [p.id, p])), [d.pathways]);
  const futureSkills = d.skills.filter((s) => s.fs_area && s.lifecycle !== 'obsolete' && s.area !== 'security');
  const covered = futureSkills.filter((s) => cat.pathways.some((p) => p.skill_id === s.id && p.level === 1)).length;
  const steps = cat.pathways.reduce((n, p) => n + p.steps, 0);
  const requested = cat.pathways.reduce((n, p) => n + p.requested, 0);
  const visible = cat.pathways.filter((p) => !p.peer.suppressed).length;
  const q = flt.q.trim().toLowerCase();
  const list = cat.pathways.filter((p) => {
    const s = skills.get(p.skill_id);
    const row = byId.get(p.id);
    if (flt.area && s?.fs_area !== flt.area) return false;
    if (flt.level && String(p.level) !== flt.level) return false;
    if (flt.status === 'mine' && !p.mine) return false;
    if (flt.status === 'ready' && p.requested > 0) return false;
    if (q && ![s?.name_en, s?.name_ar, row?.title_en, row?.title_ar].some((x) => String(x ?? '').toLowerCase().includes(q))) return false;
    return true;
  });
  const groups = FS_AREAS.map((a) => ({ area: a, skills: futureSkills.filter((s) => s.fs_area === a).map((s) => ({ s, levels: list.filter((p) => p.skill_id === s.id) })).filter((x) => x.levels.length) })).filter((g) => g.skills.length);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m19-pw-tiles">
        <StatTile label={t('m19.pw.cat.tileCovered')} value={`${f.num(covered)} / ${f.num(futureSkills.length)}`} sub={t('m19.pw.cat.tileCoveredSub')} tone={covered === futureSkills.length ? 'ok' : 'info'} />
        <StatTile label={t('m19.pw.cat.tilePathways')} value={f.num(cat.pathways.length)} sub={t('m19.pw.cat.tilePathwaysSub', { n: f.num(steps) })} />
        <StatTile label={t('m19.pw.cat.tileRequested')} value={f.num(requested)} sub={t('m19.pw.cat.tileRequestedSub')} tone="sim" />
        <StatTile label={t('m19.pw.cat.tilePeers')} value={f.num(visible)} sub={t('m19.pw.cat.tilePeersSub', { n: f.num(cat.min_group) })} />
      </div>
      <TopPicks d={d} />
      <Section title={t('m19.pw.cat.allTitle')} description={t('m19.pw.cat.allIntro')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[
          { key: 'area', label: t('m19.pw.cat.fArea'), options: [{ value: '', label: t('m19.pw.cat.all') }, ...FS_AREAS.map((a) => ({ value: a, label: t(`fs.area.${a}`) }))] },
          { key: 'level', label: t('m19.pw.cat.fLevel'), options: [{ value: '', label: t('m19.pw.cat.all') }, ...[1, 2, 3].map((l) => ({ value: String(l), label: t('m19.pw.levelLong', { n: l }) }))] },
          { key: 'status', label: t('m19.pw.cat.fStatus'), options: [{ value: '', label: t('m19.pw.cat.all') }, { value: 'mine', label: t('m19.pw.cat.fMine') }, { value: 'ready', label: t('m19.pw.cat.fReady') }] },
        ]} />
        {!groups.length ? <EmptyState icon="filter" title={t('m19.pw.cat.noMatch')} /> : (
          <div className="mt-4 space-y-6" data-testid="m19-pw-list">
            {groups.map((g) => (
              <div key={g.area}>
                <h3 className="caps mb-2">{t(`fs.area.${g.area}`)}</h3>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {g.skills.map(({ s, levels }) => <SkillCard key={s.id} skill={s} levels={levels} byId={byId} />)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Callout title={t('m19.pw.cat.howTitle')}>{t('m19.pw.cat.howBody')}</Callout>
      <p className="text-[12.5px] text-ink-3">{t('m19.pw.cat.foot')}</p>
    </div>
  );
}

function SkillCard({ skill, levels, byId }: { skill: Row; levels: PathwaySummary[]; byId: Map<string, Row> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <li className="card flex flex-col p-4" data-testid="m19-pw-skill" data-skill={skill.id}>
      <div className="flex flex-wrap items-center gap-2">
        <L to={`/skills/${skill.id}`} className="text-[15px] font-semibold">{pick(skill, 'name')}</L>
        {skill.lifecycle && <StatusPill tone={skill.lifecycle === 'declining' ? 'bad' : skill.lifecycle === 'emerging' ? 'accent' : 'neutral'}>{t(`fs.lifecycle.${skill.lifecycle}`)}</StatusPill>}
      </div>
      <ul className="mt-3 space-y-2">
        {levels.map((p) => (
          <li key={p.id} className="rounded-card border border-line p-2.5" data-testid="m19-pw-card" data-pathway={p.id} data-requested={p.requested}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2"><LevelPill level={p.level} /><L to={`/learn/pathways/${p.id}`} className="text-[13.5px] font-semibold">{pick(byId.get(p.id) ?? {}, 'title')}</L></span>
              {p.mine && <StatusPill tone={p.mine === 'completed' ? 'ok' : p.mine === 'active' ? 'accent' : 'neutral'}>{t(`m19.pw.mine.${p.mine}`)}</StatusPill>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <EnvelopeLine months={p.envelope_months} weekly={p.weekly_hours} />
              <span className="text-[12.5px] text-ink-3">{t('m19.pw.totalHours', { n: f.num(p.total_hours) })}</span>
              {p.requested > 0 ? <span className="text-[12.5px] text-sim" data-testid="m19-pw-requested">{t('m19.pw.requestedN', { n: f.num(p.requested), total: f.num(p.steps) })}</span>
                : <span className="text-[12.5px] text-ok">{t('m19.pw.allReady')}</span>}
            </div>
            <div className="mt-1"><PeerLine peer={p.peer} compact /></div>
          </li>
        ))}
      </ul>
    </li>
  );
}

function TopPicks({ d }: { d: PwRef }) {
  const t = useT();
  const q = useFsCoach();
  const picks = q.data?.ranked.slice(0, 3) ?? [];
  if (!q.data || !picks.length) return null;
  return (
    <Section title={t('m19.pw.cat.picksTitle')} description={t('m19.pw.cat.picksIntro')} actions={<L to="/my/coach" className="btn-ghost btn-sm">{t('m19.pw.cat.toCoach')}</L>}>
      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m19-pw-picks">
        {picks.map((r, i) => <CoachPathwayCard key={r.id} id={r.id} reasons={r.reasons} skills={d.skills} pathways={d.pathways} n={i + 1} />)}
      </ol>
    </Section>
  );
}

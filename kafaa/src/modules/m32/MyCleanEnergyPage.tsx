// FS41 /my/clean-energy (skills_profile Own): my CleanEnergyComp progress. Level per competence from my counted F01 skill states on the
// linked skills (rpc.cecMine; SQL kafaa_cec_profile = cecProfile), the overall level (lowest of the four areas) against my job family's
// target, <WhyThis> reasons pointing at the evidence (self-ratings shown but never counted), what to grow next with its learning items,
// "add to my goals" (FS33 saveSkillGoal) and where I stand on MC-CLEAN-ENERGY (F32 microcredEligibility). Private: nobody else reads it.
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, ConfirmDialog, EmptyState, StatTile, WhyThis, BenchmarkChips, Icon, ProgressRing } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import type { CecCompView, CecProfile } from './cec';
import { AREA_ICON, AREA_LIST, LearningLink, LevelPill, SkillChips, StatusTag, TargetBar, useCecRef, type CecRef, type Row } from './ui';

export default function MyCleanEnergyPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useCecRef();
  const q = useQuery(['person_skills', 'cec_competences'], () => repo.rpc.cecMine(), []);
  return (
    <Page title={t('m32.routes.my-clean-energy.title')} intro={t('m32.my.intro')} wide eyebrow={<BenchmarkChips feature="FS41" />}
      actions={<L to="/skills/clean-energy" className="btn-outline btn-sm no-underline" data-testid="m32-my-framework">{t('m32.my.framework')}</L>}>
      <Async state={ref}>{(d) => <Async state={q} isEmpty={(x) => !x} empty={<EmptyState title={t('m32.my.none')} />}>{(p) => (p ? <Mine d={d} p={p} /> : null)}</Async>}</Async>
    </Page>
  );
}

function addDays(iso: string, n: number) { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

function Mine({ d, p }: { d: CecRef; p: CecProfile }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [only, setOnly] = useState<'all' | 'grow'>('all');
  const [goal, setGoal] = useState<{ skill: Row; level: number; comp: Row } | null>(null);
  const elig = useQuery(['microcred_awards', 'person_skills'], () => repo.rpc.microcredEligibility(null, 'MC-CLEAN-ENERGY'), []);
  const famName = p.family_id ? pick(d.families.find((x: Row) => x.id === p.family_id) ?? { name_en: p.family_id, name_ar: p.family_id }, 'name') : '—';
  const met = p.competences.filter((v) => v.status === 'met').length;
  const counted = p.competences.filter((v) => v.level > 0).length;
  const next = p.grow.slice(0, 3).map((id) => p.competences.find((v) => v.competence_id === id)!).filter(Boolean);
  const goalSkill = (v: CecCompView) => {
    const c = d.comps.find((x: Row) => x.id === v.competence_id);
    const ids: string[] = c?.skill_ids ?? [];
    const sk = ids.map((id) => d.skills.find((s: Row) => s.id === id)).find((s: Row) => s && s.fs_area && s.area !== 'security' && s.lifecycle !== 'obsolete' && !v.evidence.some((e) => e.skill_id === s.id));
    return sk ? { skill: sk, level: Math.max(1, v.target ?? 1), comp: c } : null;
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m32-my-summary" data-level={p.level} data-status={p.status}>
        <Card padded>
          <div className="flex items-center gap-3">
            <ProgressRing value={Math.round((100 * p.level) / 3)} label={<span className="num text-[15px]">{t('m32.levelShort', { n: f.num(p.level) })}</span>} />
            <div><p className="caps text-[10.5px] text-ink-3">{t('m32.my.tile.level')}</p><LevelPill level={p.level} testId="m32-my-level" /></div>
          </div>
        </Card>
        <StatTile label={t('m32.my.tile.target')} value={p.target == null ? '—' : t('m32.levelShort', { n: f.num(p.target) })} sub={t('m32.my.tile.targetSub', { family: famName })} tone={p.status === 'met' ? 'ok' : 'info'} />
        <StatTile label={t('m32.my.tile.met')} value={t('m32.ofN', { a: f.num(met), b: f.num(p.competences.length) })} sub={t('m32.my.tile.metSub')} tone="ok" />
        <StatTile label={t('m32.my.tile.evidenced')} value={t('m32.ofN', { a: f.num(counted), b: f.num(p.competences.length) })} sub={t('m32.my.tile.evidencedSub')} />
      </div>

      <Card title={t('m32.my.overall')} actions={<WhyThis reasons={p.reasons} testId="m32-my-why-overall" />}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m32-my-areas">
          {p.areas.map((a) => (
            <div key={a.area} className="rounded-card border border-line p-2.5" data-testid="m32-my-area" data-area={a.area} data-level={a.level}>
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Icon name={AREA_ICON[a.area]} size={13} className="text-accent" />{t(`m32.area.${a.area}`)}</p>
              <div className="mt-1.5"><TargetBar level={a.level} target={p.target} testId="m32-my-area-bar" /></div>
              <p className="mt-1 text-[11.5px] text-ink-3">{a.competence_id ? t('m32.my.areaBest', { name: pick(d.comps.find((c: Row) => c.id === a.competence_id) ?? {}, 'name') }) : t('m32.my.areaNone')}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-2">{t(`m32.my.statusLine.${p.status}`, { level: f.num(p.level), target: p.target == null ? '—' : f.num(p.target) })}</p>
      </Card>

      {next.length > 0 && (
        <Section title={t('m32.my.nextTitle')} description={t('m32.my.nextIntro')}>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="m32-my-next">
            {next.map((v, i) => {
              const c = d.comps.find((x: Row) => x.id === v.competence_id);
              const g = goalSkill(v);
              return (
                <li key={v.competence_id} className="card space-y-2 p-3.5" data-testid="m32-my-next-item" data-id={v.competence_id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[12px] text-ink-3">{f.num(i + 1)}.</span>
                    <WhyThis reasons={v.reasons} testId="m32-my-next-why" />
                  </div>
                  <L to={`/skills/clean-energy/${v.competence_id}`} className="font-semibold">{c ? pick(c, 'name') : v.competence_id}</L>
                  <TargetBar level={v.level} target={v.target} />
                  <ul className="space-y-1">{((c?.learning ?? []) as Row[]).slice(0, 2).map((r) => <li key={`${r.kind}:${r.ref}`}><LearningLink r={r} testId="m32-my-next-learning" /></li>)}</ul>
                  {g && <button type="button" className="btn-outline btn-sm" onClick={() => setGoal(g)} data-testid="m32-my-goal"><Icon name="plus" size={13} />{t('m32.my.goal', { skill: pick(g.skill, 'name') })}</button>}
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('m32.my.filter')}>
        {(['all', 'grow'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(k)} data-testid={`m32-my-filter-${k}`}
            className={`chip normal-case tracking-normal ${only === k ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`}>
            {t(`m32.my.show.${k}`)} <span className="num text-ink-3">{f.num(k === 'all' ? p.competences.length : p.grow.length)}</span>
          </button>
        ))}
      </div>

      {AREA_LIST.map((a) => {
        const rows = p.competences.filter((v) => v.area === a && (only === 'all' || p.grow.includes(v.competence_id)));
        if (!rows.length) return null;
        return (
          <Section key={a} title={<span className="inline-flex items-center gap-2"><Icon name={AREA_ICON[a]} size={16} className="text-accent" />{t(`m32.area.${a}`)}</span>}>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-panel" data-testid="m32-my-list">
              {rows.map((v) => {
                const c = d.comps.find((x: Row) => x.id === v.competence_id);
                return (
                  <li key={v.competence_id} className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-center" data-testid="m32-my-competence" data-id={v.competence_id} data-status={v.status}>
                    <div className="min-w-0">
                      <L to={`/skills/clean-energy/${v.competence_id}`} className="font-semibold"><span className="num me-1.5 text-[11.5px] text-ink-3">{c?.code}</span>{c ? pick(c, 'name') : v.competence_id}</L>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusTag status={v.status} />
                        {v.focus && <span className="chip border-transparent bg-sunken normal-case tracking-normal text-ink-2" data-testid="m32-my-focus">{t('m32.my.focus')}</span>}
                        {v.claimed.length > 0 && <span className="chip border-transparent bg-sim-bg normal-case tracking-normal text-ink-2" data-testid="m32-my-claimed">{t('m32.my.claimedChip', { n: f.num(v.claimed.length) })}</span>}
                        <WhyThis reasons={v.reasons} testId="m32-my-why" />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[12px]"><LevelPill level={v.level} /><span className="text-ink-3">{v.target == null ? t('m32.my.noTarget') : t('m32.my.target', { n: f.num(v.target) })}</span></div>
                      <TargetBar level={v.level} target={v.target} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <SkillChips ids={c?.skill_ids ?? []} skills={d.skills} testId="m32-my-skills" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}

      <Card title={t('m32.my.credTitle')} eyebrow="MC-CLEAN-ENERGY">
        <Async state={elig}>{(e) => {
          const it = e.allowed ? e.items.find((x) => x.code === 'MC-CLEAN-ENERGY') : null;
          if (!it) return <p className="text-[13px] text-ink-3">{t('m32.my.credNone')}</p>;
          return (
            <ul className="space-y-1.5" data-testid="m32-my-cred">
              {it.criteria.map((cr) => (
                <li key={cr.key} className="flex items-center gap-2 text-[13px]" data-met={cr.met ? 'true' : 'false'}>
                  <Icon name={cr.met ? 'check' : 'info'} size={14} className={cr.met ? 'text-ok' : 'text-ink-3'} />{pick(cr as Row, 'label')}
                </li>
              ))}
              <li><L to="/my/skills/credentials/c/MC-CLEAN-ENERGY" className="text-[13px]">{t(it.eligible ? 'm32.my.credEligible' : 'm32.my.credOpen')}</L></li>
            </ul>
          );
        }}</Async>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m32.my.how.title')}>{t('m32.my.how.body')}</Callout>
        <Callout tone="ok" title={t('m32.my.private.title')}>{t('m32.my.private.body')}</Callout>
      </div>

      <ConfirmDialog open={!!goal} onClose={() => setGoal(null)} title={t('m32.my.goalTitle')}
        consequence={goal ? t('m32.my.goalBody', { skill: pick(goal.skill, 'name'), level: f.num(goal.level), date: f.date(addDays(todayIso(), 180)) }) : ''}
        onConfirm={() => goal && run(() => repo.rpc.saveSkillGoal({ skill_id: goal.skill.id, target_level: goal.level, target_date: addDays(todayIso(), 180), note: `CleanEnergyComp ${goal.comp?.code ?? ''}`.trim(), shared: false }),
          { success: t('m32.my.goalSaved') })} />
    </div>
  );
}

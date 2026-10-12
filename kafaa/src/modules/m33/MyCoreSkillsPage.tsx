// FS25 /my/core-skills (skills_profile Own): my evidence per Nuclear Critical Core Skill against my family's target, the McKinsey
// "proficiency against needed" view. The level comes from my F01 skill states on the linked catalogue skills (rpc.coreSkillsMine; SQL
// kafaa_cs_profile = coreProfile), each with <WhyThis> reasons pointing at the evidence; my situational judgement practice (FS26) is shown
// beside it for development only and never changes the level. Each skill offers its own development and assessment route.
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, StatTile, WhyThis, BenchmarkChips, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import type { CoreProfile, CoreSkillView } from './coreSkills';
import { CLUSTER_ICON, CLUSTER_LIST, LevelPill, NeedBar, RouteLink, StatusTag, useFamilyName, useM33Ref, type M33Ref, type Row } from './ui';

export default function MyCoreSkillsPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useM33Ref();
  const q = useQuery(['person_skills', 'sjt_attempts'], () => repo.rpc.coreSkillsMine(), []);
  return (
    <Page title={t('m33.routes.my-core-skills.title')} intro={t('m33.my.intro')} wide eyebrow={<BenchmarkChips feature="FS25" />}
      actions={<span className="flex flex-wrap gap-2">
        <L to="/my/core-skills/practice" className="btn-primary btn-sm no-underline" data-testid="m33-my-to-practice"><Icon name="sparkle" size={14} /> {t('m33.my.practice')}</L>
        <L to="/my/core-skills/problem-solving" className="btn-outline btn-sm no-underline" data-testid="m33-my-to-aps">{t('m33.routes.my-problem-solving.title')}</L>
        <L to="/my/role-play" className="btn-outline btn-sm no-underline" data-testid="m33-my-to-roleplay">{t('m33.routes.my-role-play.title')}</L>
      </span>}>
      <Async state={ref}>{(d) => <Async state={q}>{(p) => (p ? <Mine d={d} p={p} /> : <EmptyState title={t('m33.my.none')} />)}</Async>}</Async>
    </Page>
  );
}

function Mine({ d, p }: { d: M33Ref; p: CoreProfile }) {
  const t = useT();
  const f = useFormat();
  const famName = useFamilyName(d);
  const [only, setOnly] = useState<'all' | 'gaps'>('all');
  const gaps = p.skills.filter((v) => v.status === 'below' || v.status === 'no_evidence').length;
  const practised = p.skills.filter((v) => v.practice).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m33-my-summary">
        <StatTile label={t('m33.my.tile.met')} value={`${f.num(p.summary.met)} / ${f.num(p.summary.total)}`} sub={t('m33.my.tile.metSub', { family: famName(p.family_id) || '—' })} tone="ok" />
        <StatTile label={t('m33.my.tile.below')} value={f.num(p.summary.below)} sub={t('m33.my.tile.belowSub')} tone="info" />
        <StatTile label={t('m33.my.tile.none')} value={f.num(p.summary.no_evidence)} sub={t('m33.my.tile.noneSub')} />
        <StatTile label={t('m33.my.tile.practice')} value={f.num(practised)} sub={t('m33.my.tile.practiceSub')} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('m33.my.filter')}>
          {(['all', 'gaps'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(k)} data-testid={`m33-my-filter-${k}`}
              className={`chip normal-case tracking-normal ${only === k ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`}>
              {t(`m33.my.show.${k}`)} <span className="num text-ink-3">{f.num(k === 'all' ? p.skills.length : gaps)}</span>
            </button>
          ))}
        </div>
        <span className="flex items-center gap-3 text-[12px] text-ink-3" aria-hidden="true">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[rgb(var(--accent))]" />{t('m33.my.legend.level')}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 rounded bg-[rgb(var(--ok))]" />{t('m33.my.legend.target')}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-[rgb(var(--sim))]" />{t('m33.my.legend.gap')}</span>
        </span>
      </div>

      {CLUSTER_LIST.map((cl) => {
        const rows = p.skills.filter((v) => v.cluster === cl && (only === 'all' || v.status === 'below' || v.status === 'no_evidence'));
        if (!rows.length) return null;
        return (
          <Section key={cl} title={<span className="inline-flex items-center gap-2"><Icon name={CLUSTER_ICON[cl]} size={16} className="text-accent" />{t(`m33.cluster.${cl}`)}</span>}>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-panel" data-testid="m33-my-list">
              {rows.map((v) => <SkillRow key={v.core_skill_id} v={v} d={d} />)}
            </ul>
          </Section>
        );
      })}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m33.my.how.title')}>{t('m33.my.how.body')}</Callout>
        <Callout tone="ok" title={t('m33.my.private.title')}>{t('m33.my.private.body')}</Callout>
      </div>
    </div>
  );
}

function SkillRow({ v, d }: { v: CoreSkillView; d: M33Ref }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const c = d.core.find((x: Row) => x.id === v.core_skill_id);
  if (!c) return null;
  const dev = (c.development as Row[]).find((r) => r.kind !== 'practice') ?? c.development[0];
  const assess = (c.assessment as Row[]).find((r) => r.kind !== 'sjt') ?? c.assessment[0];
  return (
    <li className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-center" data-testid="m33-my-skill" data-id={v.core_skill_id} data-status={v.status}>
      <div className="min-w-0">
        <L to={`/learn/core-skills/${c.id}`} className="font-semibold"><span className="num me-1.5 text-[11.5px] text-ink-3">{c.code}</span>{pick(c, 'name')}</L>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusTag status={v.status} />
          {v.practice && <span className="chip border-transparent bg-sunken normal-case tracking-normal text-ink-2" data-testid="m33-my-practice" title={t('m33.my.practiceTitle')}>{t('m33.my.practiceChip', { pct: f.num(v.practice.pct), n: f.num(v.practice.n) })}</span>}
          <WhyThis reasons={v.reasons} testId="m33-my-why" />
        </div>
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <LevelPill level={v.level} />
          <span className="text-ink-3">{v.target == null ? t('m33.my.noTarget') : t('m33.my.target', { level: t(`m33.level.${v.target}`) })}</span>
        </div>
        <NeedBar level={v.level} target={v.target} />
      </div>
      <div className="min-w-0 space-y-1 text-[12.5px]">
        {dev && <RouteLink r={dev} d={d} />}
        {assess && <RouteLink r={assess} d={d} icon="check" />}
        <L to={`/my/core-skills/practice?skill=${c.id}`} className="inline-flex items-center gap-1.5 text-[12.5px]" data-testid="m33-my-practise-skill"><Icon name="sparkle" size={13} className="text-accent" />{t('m33.my.practiseThis')}</L>
      </div>
    </li>
  );
}

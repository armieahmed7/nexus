// FS33 /my/skills/goals: skills I want to grow. One goal per skill with a target level and date, set here, from the passport
// ("Add to my goals" in the evidence drawer) or from an FS07 skill page. Goals feed the Coach (weight 2 next to the 2030 role
// gap's 3, reason "one of your skill goals") and are private by default: sharing with my manager is opt-in and can be undone, and
// a goal can be withdrawn at any time. Security skills are never personal goals (they follow the security career path).
import { useState } from 'react';
import { Page, Async, BenchmarkChips, Callout, Card, Grid, Section, StatTile, EmptyState, Icon } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { GoalActions, GoalCard, GoalEditor, useGoalsData, type GoalsData } from './goalsUi';
import { GOAL_RULES } from './skillGoals';

export default function MyGoalsPage() {
  const t = useT();
  const s = useSession();
  const q = useGoalsData(s.identity.personId);
  const [adding, setAdding] = useState(false);
  return (
    <Page title={t('m17.routes.my-skills-goals.title')} eyebrow={<BenchmarkChips feature="FS33" />} intro={t('m17.sg.intro')} wide
      actions={<div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => setAdding(true)} disabled={!q.data} data-testid="m17-sg-add"><Icon name="plus" size={14} /> {t('m17.sg.add')}</button>
        <L to="/my/skills" className="btn-ghost btn-sm no-underline">{t('m17.wallet.toPassport')}</L>
      </div>}>
      <Callout tone="info" title={t('m17.sg.privacyTitle')}>{t('m17.sg.privacyBody')}</Callout>
      <Async state={q}>{(d) => <Goals d={d} />}</Async>
      {adding && q.data && <GoalEditor d={q.data} open onClose={() => setAdding(false)} />}
    </Page>
  );
}

function Goals({ d }: { d: GoalsData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const [sel, setSel] = useState<{ id: string; mode: 'edit' | 'share' | 'withdraw' } | null>(null);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const live = d.views.filter((v) => v.status !== 'removed');
  const removed = d.views.filter((v) => v.status === 'removed');
  const n = (st: string) => live.filter((v) => v.status === st).length;
  const cur = sel ? d.views.find((v) => v.id === sel.id) ?? null : null;
  const skillOf = (id: string) => d.skills.find((s) => s.id === id);
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m17.sg.tile.active')} value={f.num(live.length)} sub={t('m17.sg.tile.activeSub', { max: f.num(GOAL_RULES.maxActive) })} />
        <StatTile label={t('m17.sg.tile.reached')} value={f.num(n('reached'))} sub={t('m17.sg.tile.reachedSub')} tone="ok" />
        <StatTile label={t('m17.sg.tile.soon')} value={f.num(n('due_soon') + n('overdue'))} sub={t('m17.sg.tile.soonSub', { n: f.num(n('overdue')) })} tone={n('overdue') ? 'bad' : n('due_soon') ? 'sim' : undefined} />
        <StatTile label={t('m17.sg.tile.shared')} value={f.num(live.filter((v) => v.shared).length)} sub={t('m17.sg.tile.sharedSub')} tone="info" />
      </Grid>

      {d.unplanned.length > 0 && (
        <Callout tone="sim" title={t('m17.sg.unplannedTitle')}>
          <span>{t('m17.sg.unplannedBody')}</span>
          <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="m17-sg-unplanned">
            {d.unplanned.map((g) => { const sk = skillOf(g.skill_id); return (
              <li key={g.id}><button type="button" className="chip border-sim/40 bg-sim/10 text-sim" onClick={() => setPlanFor(g.skill_id)}><Icon name="calendar" size={12} /> {sk ? pick(sk, 'name') : g.skill_id} · {t('m17.sg.addDate')}</button></li>
            ); })}
          </ul>
        </Callout>
      )}

      <Section title={t('m17.sg.listTitle')} description={t('m17.sg.listBody')}>
        {live.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m17-sg-list">
            {live.map((v) => <GoalCard key={v.id} v={v} onEdit={() => setSel({ id: v.id, mode: 'edit' })} onShare={() => setSel({ id: v.id, mode: 'share' })} onWithdraw={() => setSel({ id: v.id, mode: 'withdraw' })} />)}
          </div>
        ) : <EmptyState title={t('m17.sg.empty')}>{t('m17.sg.emptyBody')}</EmptyState>}
      </Section>

      <Card title={t('m17.sg.coachTitle')} eyebrow={t('m17.sg.coachEyebrow')}>
        <div className="space-y-2 text-[13px] text-ink-2" data-testid="m17-sg-coach">
          <p>{t('m17.sg.coachBody')}</p>
          <ul className="list-disc space-y-1 ps-5">
            <li>{t('m17.sg.coachRole')}</li>
            <li>{t('m17.sg.coachGoal')}</li>
            <li>{t('m17.sg.coachWithdraw')}</li>
          </ul>
          <L to="/my/coach" className="inline-block text-[12.5px]">{t('m17.sg.toCoach')}</L>
        </div>
      </Card>

      {removed.length > 0 && (
        <Section title={t('m17.sg.removedTitle')} description={t('m17.sg.removedBody')}>
          <ul className="flex flex-wrap gap-1.5" data-testid="m17-sg-removed">
            {removed.map((v) => <li key={v.id} className="chip border-line text-ink-3" data-skill={v.skill_id}>{v.skill ? pick(v.skill, 'name') : v.skill_id} · {t('m17.sg.status.removed')}</li>)}
          </ul>
        </Section>
      )}

      <GoalActions d={d} v={cur} mode={sel?.mode ?? null} onClose={() => setSel(null)} />
      {planFor && <GoalEditor d={d} open lockSkill initial={{ skill_id: planFor, target_level: Number(d.unplanned.find((g) => g.skill_id === planFor)?.target_level ?? 2) }} onClose={() => setPlanFor(null)} />}
    </div>
  );
}

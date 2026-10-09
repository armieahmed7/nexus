// /my/simulator (M04 · F28, W4 · E3): the crew view of simulator debriefs. Crew members see the debriefs they were on (Own);
// line managers and instructors also see crews in their scope (Scope). Team ratings, the crew's self-ratings and notes, and the
// skills evidence a recorded debrief added to my passport (evidenced, never verified).
import { useState } from 'react';
import { Async, Callout, Card, EmptyState, Grid, Page, StatTile, StatusPill } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { DIMENSIONS, meanScore } from './scenarios';
import { CatChip, DebriefDrawer, RatingBars, SourceChip, useSimDebriefs, useSimLabels } from './simUi';
import type { SimDebriefView } from './backend/simulator.rpc';

export default function MySimDebriefsPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const l = useSimLabels();
  const s = useSession();
  const q = useSimDebriefs();
  const [open, setOpen] = useState<SimDebriefView | null>(null);
  const me = s.identity.personId;
  return (
    <Page title={t('m04.routes.my-simulator.title')} intro={t('m04.scn.my.intro')}>
      <Callout tone="info" title={t('m04.scn.my.ruleTitle')}>{t('m04.scn.my.ruleBody')} <L to="/my/skills">{t('m04.scn.my.passport')}</L></Callout>
      <Async state={q} empty={<EmptyState title={t('m04.scn.my.emptyTitle')}>{t('m04.scn.my.empty')}</EmptyState>}>
        {(all) => {
          const mine = all.filter((d) => d.mine);
          const others = all.filter((d) => !d.mine);
          const myEvidence = mine.reduce((n, d) => n + (d.members.find((m) => m.person_id === me)?.evidence ?? 0), 0);
          const best = DIMENSIONS.map((d) => ({ d, v: mine.length ? mine.reduce((n, x) => n + x.ratings[d], 0) / mine.length : 0 })).sort((a, b) => b.v - a.v);
          return (
            <div className="space-y-4">
              {mine.length > 0 && (
                <Grid cols={4}>
                  <StatTile label={t('m04.scn.my.sessions')} value={f.num(mine.length)} sub={t('m04.scn.my.sessionsSub', { n: mine.filter((d) => d.members.find((m) => m.person_id === me)?.present).length })} />
                  <StatTile label={t('m04.scn.my.strongest')} value={l.dim(best[0].d)} sub={t('m04.scn.my.avg', { n: f.num(Math.round(best[0].v * 10) / 10) })} tone="ok" />
                  <StatTile label={t('m04.scn.my.focus')} value={l.dim(best[best.length - 1].d)} sub={t('m04.scn.my.avg', { n: f.num(Math.round(best[best.length - 1].v * 10) / 10) })} tone="sim" />
                  <StatTile label={t('m04.scn.my.evidence')} value={f.num(myEvidence)} sub={t('m04.scn.my.evidenceSub')} />
                </Grid>
              )}
              {mine.length > 0 && (
                <section className="space-y-3" data-testid="m04-scn-my-list">
                  <h2 className="text-[15px] font-semibold">{t('m04.scn.my.mine')}</h2>
                  {mine.slice(0, 12).map((d) => <DebriefCard key={d.id} d={d} me={me} onOpen={() => setOpen(d)} />)}
                </section>
              )}
              {others.length > 0 && (
                <section className="space-y-3" data-testid="m04-scn-my-scope">
                  <h2 className="text-[15px] font-semibold">{t('m04.scn.my.scope', { n: others.length })}</h2>
                  <Card padded={false}>
                    <ul className="divide-y divide-line">
                      {others.slice(0, 30).map((d) => (
                        <li key={d.id}><button type="button" onClick={() => setOpen(d)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2 text-start text-[13px] hover:bg-sunken">
                          <span className="min-w-0">{f.date(d.held_on)} · {t('m04.common.crew')} {d.crew} · <span className="ltr text-ink-3">{d.scenario.code}</span> {pick(d.scenario, 'title')}</span>
                          <span className="num text-ink-2">{t('m04.scn.deb.meanN', { n: f.num(meanScore(d.ratings), { maximumFractionDigits: 2 }) })}</span>
                        </button></li>
                      ))}
                    </ul>
                  </Card>
                </section>
              )}
            </div>
          );
        }}
      </Async>
      <DebriefDrawer d={open} onClose={() => setOpen(null)} />
    </Page>
  );
}

function DebriefCard({ d, me, onOpen }: { d: SimDebriefView; me: string | null; onOpen: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const l = useSimLabels();
  const mine = d.members.find((m) => m.person_id === me);
  return (
    <Card title={<span><span className="ltr me-1 text-ink-3">{d.scenario.code}</span>{pick(d.scenario, 'title')}</span>} eyebrow={`${f.date(d.held_on)} · ${t('m04.common.crew')} ${d.crew} · ${d.simulator}`}
      actions={<button className="btn-ghost btn-sm" onClick={onOpen} data-testid="m04-scn-my-open">{t('m04.scn.my.open')}</button>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <RatingBars ratings={d.ratings} self={d.self_ratings} />
        <div className="space-y-2 text-[13px]">
          <div className="flex flex-wrap items-center gap-2"><CatChip c={d.scenario.category} />{mine && <StatusPill tone={mine.present ? 'ok' : 'neutral'}>{mine.present ? t('m04.scn.deb.present') : t('m04.scn.deb.absent')} · {l.pos(mine.position)}</StatusPill>}<SourceChip source={d.source} evidence={mine?.evidence ?? 0} /></div>
          {pick(d as never, 'strengths') && <p><span className="caps me-1">{t('m04.scn.deb.strengths')}</span>{pick(d as never, 'strengths')}</p>}
          {pick(d as never, 'improvements') && <p><span className="caps me-1">{t('m04.scn.deb.improvements')}</span>{pick(d as never, 'improvements')}</p>}
          {mine && mine.evidence > 0 && <p className="text-ok" data-testid="m04-scn-my-evidence">{t('m04.scn.my.addedEvidence', { n: mine.evidence })}</p>}
        </div>
      </div>
    </Card>
  );
}

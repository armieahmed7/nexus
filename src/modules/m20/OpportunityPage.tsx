// /opportunities/:id (M20 · F08): one opportunity with my match explained, the skills it needs and builds, and the apply
// flow (note → line-manager release → selection → outcome sign-off). The poster also sees the applicant pipeline here.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, KeyValue, WhyThis, EngineBadge, Modal, Icon, ConfirmDialog, ProgressBar } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { NEED_LEVEL, roleNeed } from './match';
import { useMarket, useMatches, useLabels, defaultTarget, KindChip, FlagChips, MatchRing, OppPill, AppStepper, AppTimeline, usePersonName, useRange, seatsLeft, AppPill, type MarketData, type Opp } from './ui';
import { ApplicantCard } from './Pipeline';

export default function OpportunityPage() {
  const t = useT();
  const { id = '' } = useParams();
  const { q, me, person } = useMarket();
  const pick = usePick();
  const o = q.data?.opps.find((x) => x.id === id);
  return (
    <Page title={o ? pick(o, 'title') : t('m20.routes.opportunity.title')} eyebrow={<L to="/opportunities">{t('m20.detail.back')}</L>} wide>
      <Async state={q} isEmpty={(d) => !d.opps.some((x) => x.id === id)} empty={<EmptyState icon="briefcase" title={t('m20.detail.notFound')} action={<L to="/opportunities" className="btn-outline btn-sm">{t('m20.detail.back')}</L>} />}>
        {(d) => <Detail d={d} o={d.opps.find((x) => x.id === id)!} me={me} currentRole={person?.job_role_id ?? null} family={person?.job_family_id ?? null} />}
      </Async>
    </Page>
  );
}

function Detail({ d, o, me, currentRole, family }: { d: MarketData; o: Opp; me: string | null; currentRole: string | null; family: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useLabels(d);
  const range = useRange();
  const target = defaultTarget(d.paths, currentRole, d.shortlist);
  const { eng, byId } = useMatches(d, target, currentRole, family);
  const r = byId.get(o.id);
  const lv = new Map(d.states.map((s) => [s.skill_id, s.level]));
  const sk = new Map(d.skills.map((s) => [s.id, s]));
  const myApp = d.apps.find((a) => a.opportunity_id === o.id && a.person_id === me && a.status !== 'withdrawn') ?? d.apps.find((a) => a.opportunity_id === o.id && a.person_id === me);
  const isPoster = o.posted_by === me;
  const applicants = d.apps.filter((a) => a.opportunity_id === o.id && a.person_id !== me);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-1.5"><KindChip kind={o.kind} /><OppPill status={o.status} /><FlagChips flags={o.priority_flags} /></div>
          <p className="text-[14.5px] leading-relaxed text-ink">{pick(o, 'summary')}</p>
          <div className="mt-4">
            <KeyValue items={[
              [t('m20.detail.host'), <>{lab.role(o.host_role_id)}{o.family_id ? <span className="text-ink-3"> · {lab.family(o.family_id)}</span> : null}</>],
              [t('m20.detail.dates'), range(o.start_on, o.end_on)],
              [t('m20.detail.hours'), t('m20.common.hoursWeek', { n: f.num(o.hours_week) })],
              [t('m20.detail.location'), t(`m20.location.${o.location_type}`)],
              [t('m20.detail.seats'), t('m20.common.seatsLeft', { n: f.num(seatsLeft(o)), of: f.num(o.seats) })],
              [t('m20.detail.eligible'), (o.eligible_families ?? []).length ? (o.eligible_families ?? []).map(lab.family).join(' · ') : t('m20.detail.allFamilies')],
              [t('m20.detail.posted'), f.date(o.created_at)],
            ]} />
          </div>
          {o.location_type === 'site_non_protected' && <p className="mt-3 text-[12.5px] text-ink-3">{t('m20.detail.siteNote')}</p>}
        </Card>

        <Section title={t('m20.detail.needTitle')} description={t('m20.detail.needSub', { need: NEED_LEVEL })}>
          {o.skills_needed.length === 0 ? <p className="text-ink-3">{t('m20.detail.noPrereq')}</p> : (
            <ul className="space-y-2" data-testid="m20-need-table">
              {o.skills_needed.map((id) => {
                const have = lv.get(id) ?? 0;
                return (
                  <li key={id} className="rounded-card border border-line bg-panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{lab.skill(id)}</span>
                      <span className={`chip ${have >= NEED_LEVEL ? 'border-ok-line bg-ok-bg text-ok' : 'border-sim-line bg-sim-bg text-sim'}`}>{have >= NEED_LEVEL ? t('m20.detail.met') : t('m20.detail.stretch')}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3"><ProgressBar value={(Math.min(have, NEED_LEVEL) / NEED_LEVEL) * 100} tone={have >= NEED_LEVEL ? 'ok' : 'sim'} label={lab.skill(id)} /><span className="num shrink-0 text-[12px] text-ink-2">{t('m20.common.levelOf', { have: f.num(have), need: f.num(NEED_LEVEL) })}</span></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title={t('m20.detail.gainTitle')} description={t('m20.detail.gainSub')}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m20-gain-table">
            {o.skills_gained.map((id) => {
              const have = lv.get(id) ?? 0;
              const need = Math.max(roleNeed(d.roleComps, currentRole, sk.get(id)), roleNeed(d.roleComps, target, sk.get(id)));
              return (
                <li key={id} className="rounded-card border border-accent/30 bg-accent-soft/40 p-3">
                  <div className="font-semibold">{lab.skill(id)}</div>
                  <div className="mt-0.5 text-[12.5px] text-ink-2">{need > have ? t('m20.detail.closesGap', { from: f.num(have), to: f.num(need) }) : have === 0 ? t('m20.detail.newSkill') : t('m20.detail.deepens', { lv: f.num(have) })}</div>
                </li>
              );
            })}
          </ul>
        </Section>

        {isPoster && (
          <Section title={t('m20.detail.pipeline')} description={t('m20.detail.pipelineSub')} actions={<L to="/opportunities/manage" className="btn-outline btn-sm">{t('m20.market.manage')}</L>}>
            {applicants.length === 0 ? <EmptyState icon="users" title={t('m20.manage.noApplicants')} /> : (
              <ul className="space-y-2" data-testid="m20-pipeline">{applicants.map((a) => <ApplicantCard key={a.id} app={a} opp={o} lab={lab} />)}</ul>
            )}
          </Section>
        )}
      </div>

      <aside className="space-y-4">
        {r && !isPoster && (
          <Card title={t('m20.detail.yourMatch')} actions={<EngineBadge engine={eng} />}>
            <div className="flex items-center gap-4">
              <MatchRing score={r.score} size={72} />
              <div className="flex-1 space-y-1.5 text-[12.5px]">
                {(['skills', 'development', 'target'] as const).map((k) => (
                  <div key={k}>
                    <div className="flex justify-between"><span className="text-ink-2">{t(`m20.detail.comp.${k}`)}</span><span className="num">{f.num(Math.round(r.item![k] * 100))}%</span></div>
                    <ProgressBar value={r.item![k] * 100} label={t(`m20.detail.comp.${k}`)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3"><WhyThis reasons={r.reasons} testId="m20-why" /></div>
            {target && <p className="mt-2 text-[12px] text-ink-3">{t('m20.detail.targetNote', { role: lab.role(target) })}</p>}
          </Card>
        )}
        {!isPoster && <ApplyCard o={o} app={myApp} eligible={r?.item?.eligible ?? true} />}
        <Callout tone="sim" title={t('m20.detail.mirrorTitle')}>{t('m20.detail.mirrorBody')}</Callout>
      </aside>
    </div>
  );
}

function ApplyCard({ o, app, eligible }: { o: Opp; app?: MarketData['apps'][number]; eligible: boolean }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const name = usePersonName();
  const [open, setOpen] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const live = app && app.status !== 'withdrawn';
  if (live) {
    return (
      <Card title={t('m20.detail.yourApp')} actions={<AppPill status={app.status} />}>
        <AppStepper status={app.status} />
        <p className="mt-3 text-[13px] text-ink-2">{t(`m20.next.${app.status}`)}</p>
        {app.skip_level && app.status === 'applied' && <p className="mt-1 text-[12.5px] text-info">{t('m20.detail.skipNote')}</p>}
        <div className="mt-3"><AppTimeline app={app} name={(id) => name(app, id)} /></div>
        {['applied', 'released', 'selected'].includes(app.status) && <button className="btn-ghost btn-sm mt-3" onClick={() => setWithdraw(true)} data-testid="m20-withdraw">{t('m20.my.withdraw')}</button>}
        {app.status === 'completed' && <L to="/my/skills" className="btn-outline btn-sm mt-3">{t('m20.my.openPassport')}</L>}
        <ConfirmDialog open={withdraw} onClose={() => setWithdraw(false)} title={t('m20.my.withdrawTitle')} consequence={t('m20.my.withdrawBody')} danger confirmLabel={t('m20.my.withdraw')}
          onConfirm={async () => { await run(() => repo.rpc.withdrawOpportunityApplication(app.id)); }} />
      </Card>
    );
  }
  return (
    <Card title={t('m20.detail.applyTitle')}>
      <ol className="mb-3 list-decimal space-y-1 ps-5 text-[13px] text-ink-2">
        <li>{t('m20.detail.flow1')}</li><li>{t('m20.detail.flow2')}</li><li>{t('m20.detail.flow3')}</li><li>{t('m20.detail.flow4')}</li>
      </ol>
      {o.status !== 'open' ? <p className="text-[13px] text-ink-3">{t('m20.detail.closed')}</p>
        : !eligible ? <p className="text-[13px] text-ink-3">{t('m20.detail.notEligible')}</p>
        : <button className="btn-primary w-full" onClick={() => setOpen(true)} data-testid="m20-apply"><Icon name="check" size={14} />{app ? t('m20.detail.applyAgain') : t('m20.detail.apply')}</button>}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={t('m20.detail.applyModal')}
        footer={<>
          <button className="btn-outline" onClick={() => setOpen(false)} disabled={busy}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={busy || note.length > 500} data-testid="m20-apply-confirm" onClick={async () => {
            setBusy(true);
            try { const r = await run(() => repo.rpc.applyOpportunity(o.id, note.trim())); if (r.ok) setOpen(false); } finally { setBusy(false); }
          }}>{busy ? t('common.working') : t('m20.detail.send')}</button>
        </>}>
        <div className="space-y-3">
          <label className="block">
            <span className="caps">{t('m20.detail.note')}</span>
            <textarea className="input mt-1" rows={4} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} data-testid="m20-apply-note" />
            <span className="text-[12px] text-ink-3">{t('m20.detail.noteHint')}</span>
          </label>
          <Callout title={t('m20.detail.releaseTitle')}>{t('m20.detail.releaseBody')}</Callout>
        </div>
      </Modal>
    </Card>
  );
}

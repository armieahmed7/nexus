// /opportunities/reserve/hr (M20 · F23): the HR reserve desk (hr_analyst, hr_director). Approve or decline manager requests before
// any alumnus sees them (maker-checker: never your own), shortlist members for open requests with the F08 match engine (<WhyThis>),
// invite them, approve interest ("handed to HR": contracting and contact happen outside Kafa'a), the registry of active members,
// the erasure schedule for withdrawn consent (ids and dates only) and "reserve at a glance" with every cell under 10 suppressed.
import { useMemo, useState } from 'react';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, StatTile, Tabs, Icon, ConfirmDialog, DataTable, WhyThis, EngineBadge, KeyValue } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { OPEN_ENG, type Cell, type EngagementRow, type MemberRow, type RequestRow, type ReserveDesk } from './reserve';
import { rankMembersForRequest } from './reserveMatch';
import { MatchRing, Meta } from './ui';
import { AvailChip, BandChip, EngChip, EngPill, EngTimeline, HandoffNote, MemberKindChip, ReqPill, SnapshotSkills, todayIso, useRefData, useResLabels, type RefData, type ResLabels } from './reserveUi';

export default function ReserveDeskPage() {
  const t = useT();
  const repo = useRepo();
  const ref = useRefData();
  const q = useQuery(['alumni', 'reserve_requests', 'reserve_engagements'], () => repo.rpc.reserveDesk());
  return (
    <Page title={t('m20.routes.reserve-desk.title')} eyebrow={t('m20.res.hub.eyebrow')} intro={t('m20.res.desk.intro')} wide>
      <Async state={ref} isEmpty={() => false}>
        {(d) => (
          <Async state={q} isEmpty={(x) => !x} empty={<EmptyState icon="lock" title={t('m20.res.desk.forbidden')} />}>
            {(x) => <Desk desk={x!} refd={d} />}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Desk({ desk, refd }: { desk: ReserveDesk; refd: RefData }) {
  const t = useT();
  const f = useFormat();
  const lab = useResLabels(refd);
  const st = desk.stats;
  const pending = desk.requests.filter((r) => r.status === 'pending_hr');
  const open = desk.requests.filter((r) => r.status === 'open');
  const n = (v: number | null) => (v == null ? t('m20.res.suppressed') : f.num(v));
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m20.res.desk.statMembers')} value={n(st.members)} sub={t('m20.res.desk.statMembersSub', { n: n(st.finder_optin) })} />
        <StatTile label={t('m20.res.desk.statHours')} value={n(st.hours_month)} sub={t('m20.res.desk.statHoursSub')} />
        <StatTile label={t('m20.res.desk.statPending')} value={f.num(st.requests_pending)} tone={st.requests_pending ? 'sim' : undefined} sub={t('m20.res.desk.statPendingSub', { n: f.num(st.requests_open) })} />
        <StatTile label={t('m20.res.desk.statEngagements')} value={f.num(st.engagements_active)} tone="ok" sub={t('m20.res.desk.statEngagementsSub', { n: f.num(st.engagements_completed) })} />
      </Grid>
      <Tabs initial={pending.length ? 'approve' : 'shortlist'} tabs={[
        { id: 'approve', label: t('m20.res.desk.tabApprove'), badge: pending.length || undefined, content: <ApproveTab reqs={pending} lab={lab} /> },
        { id: 'shortlist', label: t('m20.res.desk.tabShortlist'), badge: desk.engagements.filter((e) => e.status === 'interested').length || undefined, content: <ShortlistTab reqs={open} desk={desk} refd={refd} lab={lab} /> },
        { id: 'engagements', label: t('m20.res.desk.tabEngagements'), content: <EngagementsTab desk={desk} /> },
        { id: 'registry', label: t('m20.res.desk.tabRegistry'), content: <RegistryTab desk={desk} lab={lab} /> },
        { id: 'glance', label: t('m20.res.desk.tabGlance'), content: <GlanceTab desk={desk} lab={lab} /> },
      ]} />
      <Callout tone="sim" title={t('m20.res.desk.noteTitle')}>{t('m20.res.desk.noteBody')}</Callout>
    </div>
  );
}

function RequestHead({ r, lab }: { r: RequestRow; lab: ResLabels }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <div className="min-w-0">
      <div className="mb-1 flex flex-wrap gap-1.5"><EngChip kind={r.engagement} /><ReqPill status={r.status} /></div>
      <div className="text-[15px] font-semibold">{pick(r, 'title')}</div>
      <div className="text-[12.5px] text-ink-3">{pick({ name_en: r.poster_name, name_ar: r.poster_name_ar }, 'name')} · {pick(r, 'host_team')}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <Meta icon="calendar">{f.date(r.start_on)} – {f.date(r.end_on)}</Meta>
        <Meta icon="reset">{t('m20.res.hoursTotal', { n: f.num(r.hours_total) })}</Meta>
        <Meta icon="globe">{t(`m20.res.loc.${r.location_type}`)}</Meta>
        <Meta icon="users">{t('m20.res.req.places', { taken: f.num(r.seats_taken), seats: f.num(r.seats) })}</Meta>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">{r.skills_needed.map((id) => <li key={id} className="chip border-line bg-sunken text-ink-2">{lab.skill(id)}</li>)}</ul>
    </div>
  );
}

function ApproveTab({ reqs, lab }: { reqs: RequestRow[]; lab: ResLabels }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const [act, setAct] = useState<{ r: RequestRow; d: 'approve' | 'decline' } | null>(null);
  if (!reqs.length) return <EmptyState icon="check" title={t('m20.res.desk.noPending')} />;
  return (
    <div className="space-y-4" data-testid="m20-res-pending">
      {reqs.map((r) => (
        <Card key={r.id} as="article">
          <div className="flex flex-wrap items-start justify-between gap-3" data-testid="m20-res-pending-card">
            <RequestHead r={r} lab={lab} />
            <div className="flex flex-col items-end gap-2">
              {r.posted_by === me ? <span className="chip border-sim-line bg-sim-bg text-sim">{t('m20.res.desk.ownRequest')}</span> : (
                <div className="flex gap-2">
                  <button type="button" className="btn-outline btn-sm" onClick={() => setAct({ r, d: 'decline' })} data-testid="m20-res-decline-req">{t('m20.res.desk.decline')}</button>
                  <button type="button" className="btn-primary btn-sm" onClick={() => setAct({ r, d: 'approve' })} data-testid="m20-res-approve-req">{t('m20.res.desk.approve')}</button>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-[13px] text-ink-2">{pick(r, 'summary')}</p>
        </Card>
      ))}
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} title={act?.d === 'approve' ? t('m20.res.desk.approveReqTitle') : t('m20.res.desk.declineReqTitle')}
        consequence={act?.d === 'approve' ? t('m20.res.desk.approveReqBody') : t('m20.res.desk.declineReqBody')} requireReason={act?.d === 'decline'} reasonLabel={t('m20.res.desk.reason')} danger={act?.d === 'decline'}
        actingAs={t('m20.res.desk.asHr')}
        onConfirm={async (reason) => { if (act) await run(() => repo.rpc.decideReserveRequest(act.r.id, act.d, reason)); }} />
    </div>
  );
}

function ShortlistTab({ reqs, desk, refd, lab }: { reqs: RequestRow[]; desk: ReserveDesk; refd: RefData; lab: ResLabels }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const eng = useEngine('match');
  const s = useSession();
  const me = s.identity.personId;
  const today = todayIso();
  const [invite, setInvite] = useState<{ r: RequestRow; m: MemberRow } | null>(null);
  const [decide, setDecide] = useState<{ e: EngagementRow; d: 'approve' | 'decline' } | null>(null);
  const shortlists = useMemo(() => reqs.map((r) => {
    const engaged = new Set(desk.engagements.filter((e) => e.request_id === r.id).map((e) => e.alumni_id));
    const pool = desk.members.filter((m) => m.status === 'active' && m.person_id !== r.posted_by && !engaged.has(m.id) && m.availability !== 'paused');
    return { r, ranked: rankMembersForRequest(r, pool, refd.skills, today, undefined).slice(0, 4) };
  }), [reqs, desk, refd.skills, today]);
  if (!reqs.length) return <EmptyState icon="briefcase" title={t('m20.res.desk.noOpen')} />;
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><EngineBadge engine={eng} /></div>
      {shortlists.map(({ r, ranked }) => {
        const engs = desk.engagements.filter((e) => e.request_id === r.id);
        return (
          <Card key={r.id} as="article">
            <RequestHead r={r} lab={lab} />
            {engs.length > 0 && (
              <div className="mt-3 space-y-2" data-testid="m20-res-interest-list">
                <div className="caps">{t('m20.res.desk.responses')}</div>
                {engs.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-sunken/60 px-3 py-2">
                    <div className="min-w-0 text-[13px]"><span className="font-semibold">{pick({ name_en: e.alumni_name, name_ar: e.alumni_name_ar }, 'name') || t('m20.res.anonymised')}</span> <EngPill status={e.status} />{e.note && <span className="ms-2 text-ink-2">“{e.note}”</span>}</div>
                    {e.status === 'interested' && (
                      e.person_id === me || e.poster_id === me ? <span className="chip border-sim-line bg-sim-bg text-sim">{t('m20.res.desk.ownRequest')}</span> : (
                        <div className="flex gap-2">
                          <button type="button" className="btn-outline btn-sm" onClick={() => setDecide({ e, d: 'decline' })}>{t('m20.res.desk.decline')}</button>
                          <button type="button" className="btn-primary btn-sm" onClick={() => setDecide({ e, d: 'approve' })} data-testid="m20-res-handoff">{t('m20.res.desk.handoff')}</button>
                        </div>
                      )
                    )}
                    {e.status === 'invited' && <button type="button" className="btn-ghost btn-sm" onClick={() => setDecide({ e, d: 'decline' })}>{t('m20.res.desk.cancelInvite')}</button>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <div className="caps mb-2">{t('m20.res.desk.suggested')}</div>
              {ranked.length === 0 ? <p className="text-[13px] text-ink-3">{t('m20.res.desk.noCandidates')}</p> : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m20-res-shortlist">
                  {ranked.map((c) => {
                    const m = c.item!.member;
                    return (
                      <div key={m.id} className="rounded-card border border-line p-3" data-testid="m20-res-candidate">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{pick({ name_en: m.name, name_ar: m.name_ar }, 'name')}</div>
                            <div className="text-[12px] text-ink-3">{lab.role(m.former_role_id)}</div>
                            <div className="mt-1 flex flex-wrap gap-1"><MemberKindChip kind={m.kind} /><AvailChip availability={m.availability} hours={m.hours_month} /></div>
                          </div>
                          <MatchRing score={c.score} size={44} />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <WhyThis reasons={c.reasons} testId="m20-res-why" />
                          <button type="button" className="btn-outline btn-sm" onClick={() => setInvite({ r, m })} disabled={m.person_id === me} data-testid="m20-res-invite">{t('m20.res.desk.invite')}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        );
      })}
      <HandoffNote />
      <ConfirmDialog open={!!invite} onClose={() => setInvite(null)} title={t('m20.res.desk.inviteTitle')} consequence={t('m20.res.desk.inviteBody', { name: invite ? pick({ name_en: invite.m.name, name_ar: invite.m.name_ar }, 'name') : '' })} actingAs={t('m20.res.desk.asHr')}
        onConfirm={async () => { if (invite) await run(() => repo.rpc.inviteReserve(invite.r.id, invite.m.id)); }} />
      <ConfirmDialog open={!!decide} onClose={() => setDecide(null)} title={decide?.d === 'approve' ? t('m20.res.desk.handoffTitle') : t('m20.res.desk.declineEngTitle')}
        consequence={decide?.d === 'approve' ? t('m20.res.desk.handoffBody') : t('m20.res.desk.declineEngBody')} requireReason={decide?.d === 'decline'} reasonLabel={t('m20.res.desk.reason')} danger={decide?.d === 'decline'} actingAs={t('m20.res.desk.asHr')}
        onConfirm={async (reason) => { if (decide) await run(() => repo.rpc.decideReserveEngagement(decide.e.id, decide.d, reason)); }}>
        {decide && <EngTimeline history={decide.e.history} who={() => ''} />}
      </ConfirmDialog>
    </div>
  );
}

function EngagementsTab({ desk }: { desk: ReserveDesk }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const req = new Map(desk.requests.map((r) => [r.id, r]));
  return (
    <DataTable<EngagementRow> rows={desk.engagements} rowKey={(e) => e.id} caption={t('m20.res.desk.tabEngagements')} csvName="reserve-engagements"
      columns={[
        { key: 'name', header: t('m20.res.desk.colAlumnus'), value: (e) => pick({ name_en: e.alumni_name, name_ar: e.alumni_name_ar }, 'name') || t('m20.res.anonymised') },
        { key: 'request', header: t('m20.res.desk.colRequest'), value: (e) => (req.get(e.request_id) ? pick(req.get(e.request_id)!, 'title') : e.request_id) },
        { key: 'kind', header: t('m20.res.desk.colKind'), value: (e) => t(`m20.res.eng.${e.engagement}`), render: (e) => <EngChip kind={e.engagement} /> },
        { key: 'status', header: t('m20.res.desk.colStatus'), value: (e) => t(`m20.res.engStatus.${e.status}`), render: (e) => <EngPill status={e.status} /> },
        { key: 'updated', header: t('m20.res.desk.colUpdated'), value: (e) => e.updated_at, render: (e) => f.date(e.updated_at), sortable: true },
      ]} />
  );
}

function RegistryTab({ desk, lab }: { desk: ReserveDesk; lab: ResLabels }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const today = todayIso();
  const [sel, setSel] = useState<MemberRow | null>(null);
  return (
    <div className="space-y-6">
      <DataTable<MemberRow> rows={desk.members} rowKey={(m) => m.id} caption={t('m20.res.desk.tabRegistry')} csvName="reserve-registry" onRowClick={setSel}
        columns={[
          { key: 'name', header: t('m20.res.desk.colAlumnus'), value: (m) => pick({ name_en: m.name, name_ar: m.name_ar }, 'name') },
          { key: 'kind', header: t('m20.res.desk.colMemberKind'), value: (m) => t(`m20.res.kind.${m.kind}`), render: (m) => <MemberKindChip kind={m.kind} /> },
          { key: 'role', header: t('m20.res.desk.colRole'), value: (m) => lab.role(m.former_role_id) },
          { key: 'band', header: t('m20.res.desk.colBand'), value: (m) => m.departed_on ?? '', render: (m) => <BandChip departedOn={m.departed_on} today={today} />, sortable: true },
          { key: 'avail', header: t('m20.res.desk.colAvail'), value: (m) => t(`m20.res.avail.${m.availability}`), render: (m) => <AvailChip availability={m.availability} hours={m.hours_month} /> },
          { key: 'finder', header: t('m20.res.desk.colFinder'), value: (m) => (m.finder_optin ? t('common.yes') : t('common.no')) },
        ]} />
      {sel && (
        <Card title={pick({ name_en: sel.name, name_ar: sel.name_ar }, 'name')} actions={<button type="button" className="btn-ghost btn-sm" onClick={() => setSel(null)}><Icon name="close" size={13} /></button>}>
          <KeyValue items={[
            [t('m20.res.desk.colRole'), `${lab.role(sel.former_role_id)}${sel.former_org ? ` · ${lab.org(sel.former_org)}` : ''}`],
            [t('m20.res.desk.departed'), sel.departed_on ? f.date(sel.departed_on) : t('m20.res.band.departing')],
            [t('m20.res.desk.consentOn'), sel.consent_on ? f.date(sel.consent_on) : '—'],
            [t('m20.res.me.prefs'), sel.engagement_prefs.map((k) => t(`m20.res.eng.${k}`)).join(', ')],
          ]} />
          <div className="mt-3"><SnapshotSkills snapshot={sel.skill_snapshot} lab={lab} /></div>
        </Card>
      )}
      <Section title={t('m20.res.desk.erasureTitle')} description={t('m20.res.desk.erasureSub')}>
        {desk.erasures.length === 0 ? <EmptyState icon="check" title={t('m20.res.desk.noErasures')} /> : (
          <ul className="divide-y divide-line rounded-card border border-line" data-testid="m20-res-erasures">
            {desk.erasures.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
                <span className="num text-ink-2">{x.id}</span>
                <span>{t('m20.res.desk.erasureRow', { withdrawn: x.withdrawn_on ? f.date(x.withdrawn_on) : '—', erase: x.erase_after ? f.date(x.erase_after) : '—' })}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function CellTable({ title, cells, label }: { title: string; cells: Cell[]; label: (k: string) => string }) {
  const t = useT();
  const f = useFormat();
  return (
    <Card title={title}>
      <table className="w-full text-[13px]">
        <tbody>
          {cells.map((c) => (
            <tr key={c.key} className="border-b border-line last:border-0">
              <td className="py-1.5 pe-2">{label(c.key)}</td>
              <td className="py-1.5 text-end">{c.suppressed ? <span className="chip border-line bg-sunken text-ink-3" data-testid="m20-res-suppressed">{t('m20.res.suppressed')}</span> : <span className="num font-semibold">{f.num(c.n!)}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function GlanceTab({ desk, lab }: { desk: ReserveDesk; lab: ResLabels }) {
  const t = useT();
  const st = desk.stats;
  return (
    <div className="space-y-4" data-testid="m20-res-glance">
      <p className="text-[13px] text-ink-2">{t('m20.res.desk.glanceSub', { n: st.min_group })}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CellTable title={t('m20.res.desk.byKind')} cells={st.by_kind} label={(k) => t(`m20.res.kind.${k}`)} />
        <CellTable title={t('m20.res.desk.byBand')} cells={st.by_band} label={(k) => t(`m20.res.band.${k}`)} />
        <CellTable title={t('m20.res.desk.byFamily')} cells={st.by_family} label={(k) => (k === 'none' ? t('m20.common.unknownFamily') : lab.family(k))} />
        <CellTable title={t('m20.res.desk.byEngagement')} cells={st.by_engagement} label={(k) => t(`m20.res.eng.${k}`)} />
      </div>
      <p className="text-[12.5px] text-ink-3">{t('m20.res.desk.openEngNote', { n: desk.engagements.filter((e) => OPEN_ENG.includes(e.status as never)).length })}</p>
    </div>
  );
}

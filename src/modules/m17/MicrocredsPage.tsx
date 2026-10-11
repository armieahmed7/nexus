// F32 /my/skills/credentials: stackable micro-credentials. The catalogue of published micro-credentials with my eligibility from
// F01 evidence (each criterion, the record it rests on, <WhyThis>), "what it unlocks" (roles in the career catalogue), stacked
// credentials with their components, claim / request (manual criteria: a training manager confirms) / renew, my awards with the
// signed Open Badges 3.0 credential (download, public verify link) and withdrawal. Internal recognition: never a FANR
// certificate, licence or qualification.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Async, Card, Callout, ConfirmDialog, Drawer, EmptyState, Grid, KeyValue, Section, StatTile, WhyThis, Icon, downloadText, DataTable, type Column } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { verifyCredential } from './issuer';
import { shareUrl, SignatureChip } from './WalletPage';
import { awardView, componentsOf, type AwardRow, type DefRow, type Eligibility } from './microcred';
import { AreaChip, CriteriaList, McMedal, McStatusPill, ProgressLine, cardState, eligibilityReasons, useMcData, type McData } from './mcUi';

export default function MicrocredsPage() {
  const t = useT();
  const s = useSession();
  const q = useMcData(s.identity.personId);
  return (
    <Page title={t('m17.routes.my-skills-credentials.title')} eyebrow={t('m17.mc.eyebrow')} intro={t('m17.mc.intro')} wide
      actions={<div className="flex flex-wrap gap-2"><L to="/my/skills/credentials/future" className="btn-primary btn-sm no-underline" data-testid="m17-to-future">{t('m17.fc.toFuture')}</L><L to="/my/skills/wallet" className="btn-outline btn-sm no-underline">{t('m17.mc.toWallet')}</L><L to="/my/skills" className="btn-ghost btn-sm no-underline">{t('m17.wallet.toPassport')}</L></div>}>
      <Callout tone="sim" title={t('m17.mc.noticeTitle')}>{t('m17.mc.notice')}</Callout>
      <Async state={q}>{(d) => <Catalogue d={d} />}</Async>
    </Page>
  );
}

function Catalogue({ d }: { d: McData }) {
  const t = useT();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const [area, setArea] = useState<string>('all');
  const current = d.defs.filter((x) => x.status === 'current');
  const byCode = new Map(d.items.map((e) => [e.code, e]));
  const states = current.map((def) => ({ def, e: byCode.get(def.code), st: cardState(d, def, byCode.get(def.code)) }));
  const count = (k: string[]) => states.filter((x) => k.includes(x.st.status)).length;
  const stacks = states.filter((x) => x.def.kind === 'stack');
  const micro = states.filter((x) => x.def.kind === 'micro' && (area === 'all' || x.def.area === area));
  const areas = [...new Set(current.filter((x) => x.kind === 'micro').map((x) => x.area))];
  const open = params.get('code');
  const sel = open ? states.find((x) => x.def.code === open) : undefined;
  const show = (code: string | null) => { const p = new URLSearchParams(params); if (code) p.set('code', code); else p.delete('code'); setParams(p, { replace: true }); };
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m17.mc.tile.held')} value={f.num(count(['active', 'renewal_due']))} sub={t('m17.mc.tile.heldSub', { n: f.num(count(['renewal_due'])) })} tone="ok" />
        <StatTile label={t('m17.mc.tile.ready')} value={f.num(count(['eligible']))} sub={t('m17.mc.tile.readySub')} tone="info" />
        <StatTile label={t('m17.mc.tile.pending')} value={f.num(count(['pending_approval']))} sub={t('m17.mc.tile.pendingSub')} />
        <StatTile label={t('m17.mc.tile.renew')} value={f.num(count(['renewal_due', 'expired']))} sub={t('m17.mc.tile.renewSub')} tone={count(['renewal_due', 'expired']) ? 'sim' : undefined} />
      </Grid>

      <Section title={t('m17.mc.stacksTitle')} description={t('m17.mc.stacksBody')}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m17-mc-stacks">
          {stacks.map(({ def, e, st }) => (
            <Card key={def.code} className="h-full">
              <div className="flex items-start gap-3" data-testid="m17-mc-stack" data-code={def.code} data-status={st.status}>
                <McMedal code={def.code} status={st.status} stack size={60} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="caps">{t('m17.mc.kind.stack')}</span><McStatusPill status={st.status} /></div>
                  <button type="button" className="text-start text-[15px] font-semibold leading-snug hover:underline" onClick={() => show(def.code)}>{<PickTitle row={def} />}</button>
                  <StackParts def={def} d={d} e={e} />
                  {e && <ProgressLine e={e} />}
                  {st.status === 'renewal_due' && st.reason === 'component' && <p className="text-[12.5px] text-sim">{t('m17.mc.stackComponentDue')}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={t('m17.mc.catalogueTitle')} description={t('m17.mc.catalogueBody')}
        actions={<div className="flex flex-wrap gap-1" role="group" aria-label={t('m17.mc.filterArea')}>
          {['all', ...areas].map((a) => <button key={a} type="button" aria-pressed={area === a} className={`chip ${area === a ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink-2'}`} onClick={() => setArea(a)}>{a === 'all' ? t('m17.mc.allAreas') : t(`m17.mc.area.${a}`)}</button>)}
        </div>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m17-mc-catalogue">
          {micro.map(({ def, e, st }) => <McCard key={def.code} def={def} e={e} st={st} d={d} onOpen={() => show(def.code)} />)}
        </div>
      </Section>

      <MyAwards d={d} />
      {sel && <McDrawer d={d} def={sel.def} e={sel.e} st={sel.st} onClose={() => show(null)} />}
    </div>
  );
}

function PickTitle({ row }: { row: { title_en: string; title_ar: string } }) {
  const pick = usePick();
  return <>{pick(row, 'title')}</>;
}

function StackParts({ def, d, e }: { def: DefRow; d: McData; e?: Eligibility }) {
  const pick = usePick();
  const parts = componentsOf(d.defs, def.code);
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={def.code}>
      {parts.map((p) => {
        const c = e?.components.find((x) => x.code === p.code);
        return (
          <li key={p.code} className={`chip max-w-full whitespace-normal ${c?.met ? 'border-ok/40 bg-ok/10 text-ok' : c && c.status !== 'none' ? 'border-sim/40 bg-sim/10 text-sim' : 'border-line text-ink-3'}`} data-met={c?.met ? 'yes' : 'no'}>
            <Icon name={c?.met ? 'check' : 'info'} size={12} /> {pick(p, 'title')}
          </li>
        );
      })}
    </ul>
  );
}

type St = ReturnType<typeof cardState>;
function McCard({ def, e, st, d, onOpen }: { def: DefRow; e?: Eligibility; st: St; d: McData; onOpen: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const roles = def.role_ids.map((id) => d.roles.find((r) => r.id === id)).filter(Boolean);
  const stack = def.stacks_into ? d.defs.find((x) => x.code === def.stacks_into && x.status === 'current') : null;
  return (
    <Card className="h-full">
      <div className="flex h-full flex-col gap-3" data-testid="m17-mc-card" data-code={def.code} data-status={st.status}>
        <div className="flex items-start gap-3">
          <McMedal code={def.code} status={st.status} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5"><AreaChip area={def.area} /><span className="caps">{t(`m17.mc.level.${def.level}`)}</span></div>
            <button type="button" className="mt-1 text-start text-[15px] font-semibold leading-snug hover:underline" onClick={onOpen} data-testid="m17-mc-open">{pick(def, 'title')}</button>
            <div className="mt-1 flex flex-wrap items-center gap-1.5"><McStatusPill status={st.status} />{st.daysLeft != null && st.status === 'renewal_due' && st.reason === 'window' && <span className="text-[12px] text-sim">{t('m17.mc.daysLeft', { n: f.num(st.daysLeft) })}</span>}</div>
          </div>
        </div>
        <p className="text-[13px] text-ink-2">{pick(def, 'summary')}</p>
        {e && <ProgressLine e={e} />}
        {stack && <p className="text-[12px] text-ink-3"><Icon name="link" size={12} className="inline" /> {t('m17.mc.stacksInto', { title: pick(stack, 'title') })}</p>}
        {roles.length > 0 && <p className="text-[12px] text-ink-3">{t('m17.mc.unlocksShort', { roles: roles.slice(0, 2).map((r) => pick(r, 'title')).join(' · ') })}{roles.length > 2 ? ` +${f.num(roles.length - 2)}` : ''}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {e ? <WhyThis reasons={eligibilityReasons(e, (c) => ({ en: c.label_en, ar: c.label_ar }))} testId="m17-mc-why" /> : <span />}
          <McAction def={def} e={e} st={st} />
        </div>
      </div>
    </Card>
  );
}

/** Claim / request / renew, or a link to the credential. Consequential: behind a ConfirmDialog. */
export function McAction({ def, e, st }: { def: DefRow; e?: Eligibility; st: St }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const act = useAction();
  const [ask, setAsk] = useState(false);
  const renew = (st.status === 'renewal_due' || st.status === 'expired') && e?.auto_met;
  const claim = st.status === 'eligible' || renew;
  if (!claim) return st.award?.public_slug && st.status !== 'superseded' ? <a className="btn-ghost btn-sm" href={shareUrl(st.award.public_slug)} target="_blank" rel="noopener noreferrer">{t('m17.mc.verifyLink')}</a> : null;
  const manual = (e?.manual ?? 0) > 0;
  const label = renew ? t('m17.mc.act.renew') : manual ? t('m17.mc.act.request') : t('m17.mc.act.claim');
  return (
    <>
      <button type="button" className="btn-primary btn-sm" onClick={() => setAsk(true)} data-testid="m17-mc-claim">{label}</button>
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} title={`${label}: ${pick(def, 'title')}`}
        consequence={manual ? t('m17.mc.act.requestBody') : renew ? t('m17.mc.act.renewBody') : t('m17.mc.act.claimBody')}
        onConfirm={async () => { await act(() => repo.rpc.awardMicrocred(def.code)); }} />
    </>
  );
}

function McDrawer({ d, def, e, st, onClose }: { d: McData; def: DefRow; e?: Eligibility; st: St; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const roles = def.role_ids.map((id) => d.roles.find((r) => r.id === id)).filter(Boolean);
  const versions = d.defs.filter((x) => x.code === def.code).sort((a, b) => b.version - a.version);
  const award = st.award && st.award.status !== 'pending_approval' ? st.award : null;
  const cred = award?.credential as Record<string, unknown> | undefined;
  const check = cred && Object.keys(cred).length ? verifyCredential(cred) : null;
  return (
    <Drawer open onClose={onClose} title={<span className="flex items-center gap-2"><McMedal code={def.code} status={st.status} stack={def.kind === 'stack'} size={36} />{pick(def, 'title')}</span>}>
      <div className="space-y-5" data-testid="m17-mc-drawer">
        <div className="flex flex-wrap gap-1.5"><McStatusPill status={st.status} /><AreaChip area={def.area} /><span className="chip border-line text-ink-2">{t(`m17.mc.level.${def.level}`)}</span><span className="chip border-line text-ink-2"><span className="num">{def.code}</span>&nbsp;v{f.num(def.version)}</span></div>
        <p className="text-[13.5px] text-ink-2">{pick(def, 'summary')}</p>
        <KeyValue items={[
          [t('m17.mc.validity'), t('m17.mc.months', { n: f.num(def.validity_months) })],
          [t('m17.mc.hours'), def.hours ? t('m17.mc.hoursN', { n: f.num(def.hours) }) : '—'],
          [t('m17.mc.effective'), def.effective_date ? f.date(def.effective_date) : '—'],
          ...(award ? [[t('m17.badge.issued'), award.issued_on ? f.date(award.issued_on) : '—'] as [string, string], [t('m17.badge.validTo'), award.valid_to ? f.date(award.valid_to) : '—'] as [string, string]] : []),
        ]} />
        <div>
          <h3 className="caps mb-2">{t('m17.mc.criteriaTitle')}</h3>
          {e ? <CriteriaList e={e} def={def} /> : <p className="text-[13px] text-ink-3">{t('m17.mc.noEligibility')}</p>}
          {e && <div className="mt-2"><WhyThis reasons={eligibilityReasons(e, (c) => ({ en: c.label_en, ar: c.label_ar }))} testId="m17-mc-drawer-why" /></div>}
        </div>
        <div>
          <h3 className="caps mb-2">{t('m17.mc.unlocksTitle')}</h3>
          {roles.length ? <ul className="flex flex-wrap gap-1.5">{roles.map((r) => <li key={r.id}><L to={`/careers/roles/${r.id}`} className="chip max-w-full whitespace-normal border-line text-ink-2 no-underline hover:border-accent">{pick(r, 'title')}</L></li>)}</ul> : <p className="text-[13px] text-ink-3">{t('m17.mc.unlocksNone')}</p>}
          <p className="mt-1 text-[12px] text-ink-3">{t('m17.mc.unlocksNote')} <L to="/my/career">{t('m17.mc.toNavigator')}</L></p>
        </div>
        {award && cred && check && (
          <Card title={t('m17.mc.credentialTitle')}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5"><SignatureChip outcome={check.outcome} keyId={check.keyId} /></div>
              <div className="flex flex-wrap gap-2">
                {award.public_slug && <a className="btn-outline btn-sm" href={shareUrl(award.public_slug)} target="_blank" rel="noopener noreferrer" data-testid="m17-mc-verify"><Icon name="external" size={12} /> {t('m17.mc.verifyLink')}</a>}
                <button type="button" className="btn-outline btn-sm" onClick={() => downloadText(`${def.code.toLowerCase()}-${award.public_slug}.json`, JSON.stringify(cred, null, 2), 'application/json')} data-testid="m17-mc-download"><Icon name="download" size={12} /> {t('m17.badge.download')}</button>
              </div>
            </div>
          </Card>
        )}
        {versions.length > 1 && (
          <div>
            <h3 className="caps mb-2">{t('m17.mc.versions')}</h3>
            <ul className="space-y-1 text-[12.5px] text-ink-2">{versions.map((v) => <li key={v.id}>v{f.num(v.version)} · {t(`m17.mc.defStatus.${v.status}`)}{v.effective_date ? ` · ${f.date(v.effective_date)}` : ''}{v.change_reason ? ` · ${v.change_reason}` : ''}</li>)}</ul>
          </div>
        )}
        <p className="text-[12px] text-ink-3">{t('m17.mc.notice')}</p>
      </div>
    </Drawer>
  );
}

function MyAwards({ d }: { d: McData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [wd, setWd] = useState<AwardRow | null>(null);
  const defOf = useMemo(() => new Map(d.defs.map((x) => [x.id, x])), [d.defs]);
  const rows = [...d.awards].sort((a, b) => String(b.issued_on ?? b.requested_at ?? '').localeCompare(String(a.issued_on ?? a.requested_at ?? '')));
  const cols: Column<AwardRow>[] = [
    { key: 'title', header: t('m17.mc.col.credential'), value: (a) => a.def_code, sortable: true, render: (a) => { const df = defOf.get(a.def_id); return <span className="font-semibold">{df ? pick(df, 'title') : a.def_code} <span className="num text-[11.5px] text-ink-3">{a.def_code} v{a.def_version}</span></span>; } },
    { key: 'status', header: t('m17.mc.col.status'), value: (a) => a.status, render: (a) => <McStatusPill status={awardView(a, d.today, d.awards).status} /> },
    { key: 'issued', header: t('m17.badge.issued'), value: (a) => a.issued_on ?? '', sortable: true, render: (a) => (a.issued_on ? f.date(a.issued_on) : t('m17.mc.requestedOn', { date: f.date(String(a.requested_at ?? '').slice(0, 10)) })) },
    { key: 'valid', header: t('m17.badge.validTo'), value: (a) => a.valid_to ?? '', sortable: true, render: (a) => (a.valid_to ? f.date(a.valid_to) : '—') },
    { key: 'act', header: '', value: () => '', render: (a) => (a.status === 'awarded' || a.status === 'pending_approval') ? <button type="button" className="btn-ghost btn-sm" onClick={() => setWd(a)} data-testid="m17-mc-withdraw">{a.status === 'pending_approval' ? t('m17.mc.act.cancel') : t('m17.badge.withdraw')}</button> : a.decision_note ? <span className="text-[12px] text-ink-3">{a.decision_note}</span> : null },
  ];
  return (
    <Section title={t('m17.mc.mineTitle')} description={t('m17.mc.mineBody')}>
      {rows.length ? <div data-testid="m17-mc-mine"><DataTable rows={rows} columns={cols} rowKey={(a) => a.id} csvName="my-micro-credentials.csv" searchable={false} /></div>
        : <EmptyState title={t('m17.mc.mineEmpty')}>{t('m17.mc.mineEmptyBody')}</EmptyState>}
      <ConfirmDialog open={!!wd} onClose={() => setWd(null)} title={t('m17.mc.withdrawTitle')} consequence={t('m17.mc.withdrawBody')} danger requireReason reasonLabel={t('m17.badge.withdrawReason')}
        onConfirm={async (reason) => { if (wd) await act(() => repo.rpc.revokeMicrocred(wd.id, reason)); }} />
    </Section>
  );
}

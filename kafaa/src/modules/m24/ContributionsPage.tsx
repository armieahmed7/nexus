// /knowledge/contributions (M24 · FS44, knowledge A = the knowledge-management owner): publish submitted lectures (re-screened; never your
// own) and validate expert contributions. A validated contribution writes skill evidence (rating, validated; level 3 for a speaker or an SME,
// 2 for an author; never security, cyber hygiene or obsolete skills) and recomputes the person's skills; a rejection needs a reason and
// writes nothing. "Find new contributions" opens the missing ones for published lectures and knowledge assets.
import { useState } from 'react';
import { Page, Async, EmptyState, Tabs, Callout, StatTile, BenchmarkChips, Icon, WhyThis, DataTable, ConfirmDialog, Card } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ContribPill, LibrarySources, minutes } from './fs44ui';
import { Chips, useKcLabels, useKcRefs, type KcRefs } from './ui';
import type { ContributionQueue, ContributionView, LectureReview } from './backend/rpc';

export default function ContributionsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const refs = useKcRefs();
  const q = useQuery(['contributions', 'lectures', 'skill_evidence'], async () => {
    const v = await repo.rpc.contributionQueue().catch(() => null);
    return { v };
  }, [s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-contributions.title')} intro={t('m24.ctb.intro')} wide eyebrow={<BenchmarkChips feature="FS44" />}
      actions={<L to="/knowledge/lectures" className="btn-ghost btn-sm no-underline">{t('m24.ctb.toLibrary')}</L>}>
      <Async state={refs}>
        {(r) => (
          <Async state={q} isEmpty={(d) => !d.v} empty={<EmptyState icon="lock" title={t('m24.ctb.noAccess')} />}>
            {(d) => <Body v={d.v!} refs={r} reload={() => q.reload?.()} />}
          </Async>
        )}
      </Async>
    </Page>
  );
}

function Body({ v, refs, reload }: { v: ContributionQueue; refs: KcRefs; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const [sync, setSync] = useState(false);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" data-testid="m24-ctb-tiles">
        <StatTile label={t('m24.ctb.tile.review')} value={f.num(v.review.length)} tone="sim" />
        <StatTile label={t('m24.ctb.tile.pending')} value={f.num(v.stats.pending)} tone="sim" />
        <StatTile label={t('m24.ctb.tile.validated')} value={f.num(v.stats.validated)} tone="ok" />
        <StatTile label={t('m24.ctb.tile.people')} value={f.num(v.stats.people)} sub={t('m24.ctb.tile.peopleSub')} />
        <StatTile label={t('m24.ctb.tile.evidence')} value={f.num(v.stats.evidence)} sub={t('m24.ctb.tile.evidenceSub')} />
      </div>
      <Callout title={t('m24.ctb.ruleTitle')}><span data-testid="m24-ctb-rule">{t('m24.ctb.ruleBody')}</span></Callout>
      {v.can_decide && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-outline btn-sm" onClick={() => setSync(true)} data-testid="m24-ctb-sync"><Icon name="reset" size={14} /> {t('m24.ctb.sync')}</button>
          <span className="text-[12px] text-ink-3">{t('m24.ctb.syncHelp')}</span>
        </div>
      )}
      <Tabs tabs={[
        { id: 'review', label: `${t('m24.ctb.tabReview')} (${f.num(v.review.length)})`, content: <Review items={v.review} refs={refs} canDecide={v.can_decide} reload={reload} /> },
        { id: 'pending', label: `${t('m24.ctb.tabPending')} (${f.num(v.pending.length)})`, content: <Pending items={v.pending} refs={refs} canDecide={v.can_decide} reload={reload} /> },
        { id: 'decided', label: t('m24.ctb.tabDecided'), content: <Decided items={v.decided} refs={refs} /> },
      ]} />
      <LibrarySources />
      <ConfirmDialog open={sync} onClose={() => setSync(false)} title={t('m24.ctb.sync')} consequence={t('m24.ctb.syncConsequence')}
        onConfirm={async () => { setSync(false); const r = await act(() => repo.rpc.syncContributions()); if (r.ok) reload(); }} />
    </div>
  );
}

function Review({ items, refs, canDecide, reload }: { items: LectureReview[]; refs: KcRefs; canDecide: boolean; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const lab = useKcLabels(refs);
  const [pub, setPub] = useState<LectureReview | null>(null);
  const [wd, setWd] = useState<LectureReview | null>(null);
  if (!items.length) return <div className="pt-4"><EmptyState icon="check" title={t('m24.ctb.noReview')}>{t('m24.ctb.noReviewBody')}</EmptyState></div>;
  return (
    <div className="space-y-3 pt-4">
      <ul className="space-y-3" data-testid="m24-ctb-review">
        {items.map((l) => {
          const own = l.speaker_id === s.identity.personId || l.created_by === s.identity.personId;
          return (
            <li key={l.id} className="card p-4" data-testid="m24-ctb-review-item" data-id={l.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{pick(l, 'title')}</div>
                  <div className="text-[12.5px] text-ink-2">{pick({ n_en: l.speaker_name, n_ar: l.speaker_name_ar }, 'n')} · {f.date(l.delivered_on)} · {minutes(t, f, l.duration_min)} · {t(`m24.lc.format.${l.format}`)} · {t(`m24.family.${l.system_family}`)}</div>
                </div>
                {canDecide && (
                  <span className="flex flex-wrap gap-2">
                    <button className="btn-primary btn-sm" disabled={own} title={own ? t('m24.ctb.ownLecture') : undefined} onClick={() => setPub(l)} data-testid="m24-ctb-publish"><Icon name="check" size={14} /> {t('m24.ctb.publish')}</button>
                    <button className="btn-outline btn-sm" onClick={() => setWd(l)} data-testid="m24-ctb-withdraw">{t('m24.ctb.return')}</button>
                  </span>
                )}
              </div>
              <p className="mt-2 text-[13px] text-ink-2">{pick(l, 'abstract')}</p>
              <div className="mt-2"><Chips items={l.skill_ids.map((id) => lab.skill(id))} /></div>
              <p className="mt-2 text-[12px] text-ink-3">{l.position_id ? t('m24.lc.protects', { role: pick({ p_en: l.position_title_en, p_ar: l.position_title_ar }, 'p') }) : t('m24.lc.noPosition')}</p>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!pub} onClose={() => setPub(null)} title={t('m24.ctb.publish')} consequence={t('m24.ctb.publishConsequence', { title: pub ? pick(pub, 'title') : '' })}
        actingAs={t('m24.ctb.actingKm')} onConfirm={async () => { const l = pub!; setPub(null); const r = await act(() => repo.rpc.publishLecture(l.id)); if (r.ok) reload(); }} />
      <ConfirmDialog open={!!wd} onClose={() => setWd(null)} title={t('m24.ctb.return')} consequence={t('m24.ctb.returnConsequence')} requireReason danger
        reasonLabel={t('m24.lc.withdrawReason')} onConfirm={async (reason) => { const l = wd!; setWd(null); const r = await act(() => repo.rpc.withdrawLecture(l.id, reason)); if (r.ok) reload(); }} />
    </div>
  );
}

function Pending({ items, refs, canDecide, reload }: { items: ContributionView[]; refs: KcRefs; canDecide: boolean; reload: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const act = useAction();
  const lab = useKcLabels(refs);
  const [dec, setDec] = useState<{ c: ContributionView; d: 'validate' | 'reject' } | null>(null);
  if (!items.length) return <div className="pt-4"><EmptyState icon="check" title={t('m24.ctb.noPending')} /></div>;
  return (
    <div className="space-y-3 pt-4">
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m24-ctb-pending">
        {items.map((c) => {
          const own = c.person_id === s.identity.personId;
          const gone = c.source_status !== 'published';
          const ev = new Set(c.evidence_skill_ids);
          return (
            <li key={c.id} className="card flex min-w-0 flex-col gap-2 p-4" data-testid="m24-ctb-item" data-id={c.id} data-source={c.source_status}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="chip border-line bg-sunken text-ink-2"><Icon name={c.kind === 'lecture' ? 'book' : 'sparkle'} size={12} />{t(`m24.lc.kind.${c.kind}`)} · {t(`m24.lc.role.${c.contributor_role}`)}</span>
                <WhyThis testId="m24-ctb-why" reasons={c.reasons} />
              </div>
              <div className="font-semibold">{c.kind === 'lecture' ? <L to={`/knowledge/lectures/${c.ref_id}`} className="link">{pick(c, 'title')}</L> : <L to={`/knowledge/assets/${c.ref_id}`} className="link">{pick(c, 'title')}</L>}</div>
              <div className="text-[12.5px] text-ink-2">{pick({ n_en: c.person_name, n_ar: c.person_name_ar }, 'n')} · {t('m24.ctb.levelN', { n: f.num(c.level) })} · {c.source_date ? f.date(c.source_date) : '—'}</div>
              <div className="flex flex-wrap gap-1.5" data-testid="m24-ctb-skills">
                {c.skill_ids.map((id) => <span key={id} className={`chip ${ev.has(id) ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-3 line-through'}`} data-evidence={ev.has(id) ? 'yes' : 'no'} title={ev.has(id) ? t('m24.ctb.carries') : t('m24.ctb.noCarry')}>{lab.skill(id)}</span>)}
              </div>
              {gone && <p className="text-[12px] text-bad">{t('m24.ctb.sourceGone')}</p>}
              {canDecide && (
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <button className="btn-primary btn-sm" disabled={own || gone || ev.size === 0} title={own ? t('m24.ctb.ownContribution') : undefined} onClick={() => setDec({ c, d: 'validate' })} data-testid="m24-ctb-validate"><Icon name="check" size={14} /> {t('m24.ctb.validate')}</button>
                  <button className="btn-outline btn-sm" disabled={own} onClick={() => setDec({ c, d: 'reject' })} data-testid="m24-ctb-reject">{t('m24.ctb.reject')}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!dec} onClose={() => setDec(null)} title={dec?.d === 'reject' ? t('m24.ctb.reject') : t('m24.ctb.validate')} requireReason={dec?.d === 'reject'} danger={dec?.d === 'reject'}
        reasonLabel={t('m24.ctb.rejectReason')} actingAs={t('m24.ctb.actingKm')}
        consequence={dec ? (dec.d === 'validate' ? t('m24.ctb.validateConsequence', { n: f.num(dec.c.evidence_skill_ids.length), level: f.num(dec.c.level), name: pick({ n_en: dec.c.person_name, n_ar: dec.c.person_name_ar }, 'n') }) : t('m24.ctb.rejectConsequence')) : ''}
        onConfirm={async (reason) => { const x = dec!; setDec(null); const r = await act(() => repo.rpc.validateContribution(x.c.id, x.d, reason)); if (r.ok) reload(); }} />
    </div>
  );
}

function Decided({ items, refs }: { items: ContributionView[]; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useKcLabels(refs);
  if (!items.length) return <div className="pt-4"><EmptyState icon="info" title={t('m24.ctb.noDecided')} /></div>;
  return (
    <div className="pt-4" data-testid="m24-ctb-decided">
      <Card>
        <DataTable rows={items} rowKey={(c) => c.id} csvName="contributions-decided" columns={[
          { key: 'person', header: t('m24.lc.col.person'), value: (c) => pick({ n_en: c.person_name, n_ar: c.person_name_ar }, 'n'), sortable: true },
          { key: 'source', header: t('m24.lc.col.source'), value: (c) => pick(c, 'title') },
          { key: 'role', header: t('m24.lc.col.role'), value: (c) => t(`m24.lc.role.${c.contributor_role}`) },
          { key: 'skills', header: t('m24.lc.col.evidence'), value: (c) => c.evidence_skill_ids.map(lab.skill).join(', '), render: (c) => <span className="text-[12.5px]">{c.status === 'validated' ? c.evidence_skill_ids.map(lab.skill).join(' · ') : '—'}</span> },
          { key: 'status', header: t('m24.lc.col.status'), value: (c) => c.status, render: (c) => <ContribPill status={c.status} /> },
          { key: 'on', header: t('m24.lc.col.decided'), value: (c) => c.decided_on ?? '', render: (c) => f.date(c.decided_on), sortable: true },
          { key: 'by', header: t('m24.lc.col.by'), value: (c) => pick({ n_en: c.decided_by_name, n_ar: c.decided_by_name_ar }, 'n') },
          { key: 'note', header: t('m24.lc.col.note'), value: (c) => c.note ?? '' },
        ]} />
      </Card>
    </div>
  );
}

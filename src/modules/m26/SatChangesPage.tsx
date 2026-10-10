// /training/sat/changes (M26 · F27): SAT changes and their review items. Each change lists what it touched (courses, standards,
// JPMs, assessment items as metadata only); every affected course and qualification standard is one review item. A course item
// closes as "updated" or "no change" (with a reason); a standard item closes as "revised" after the standard is revised with the
// existing M02 reviseStandard (new version, records flagged for review), or "no change". The change closes with its last item.
import { useState } from 'react';
import { Page, Card, Async, EmptyState, Callout, ConfirmDialog, FilterBar, useFilters } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSatData, useSatModel, type SatData, type SatModel } from './ui';
import { FutureDiff } from './fxui'; // FS06

type Item = SatData['items'][number];
type Act = { item: Item; kind: 'updated' | 'revised' | 'no_change' | 'revise_std' } | null;

export default function SatChangesPage() {
  const t = useT();
  const q = useSatData();
  const m = useSatModel(q.data);
  return (
    <Page title={t('m26.routes.training-sat-changes.title')} intro={t('m26.changes.intro')} wide>
      <Async state={q}>{(d) => (m ? <Changes d={d} m={m} /> : null)}</Async>
    </Page>
  );
}

function Changes({ d, m }: { d: SatData; m: SatModel }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const [flt, setFlt] = useFilters({ status: 'open', role: '', area: '' }, true);
  const [act, setAct] = useState<Act>(null);
  const canW = s.can('sat', ['W', 'A']);
  const canRevise = s.can('frameworks', ['W', 'A']);
  const xs = d.changes.filter((c) => (!flt.status || c.status === flt.status) && (!flt.role || c.role_id === flt.role) && (!flt.area || (c.area ?? 'content') === flt.area));
  const roles = [...new Set(d.changes.map((c) => c.role_id))];
  const superseded = (stdId: string) => d.standards.find((x) => x.supersedes_id === stdId);
  return (
    <div className="space-y-4">
      <FilterBar value={flt} onChange={setFlt} fields={[
        { key: 'status', label: t('m26.changes.filterStatus'), options: [{ value: 'open', label: t('m26.changes.status.open') }, { value: 'closed', label: t('m26.changes.status.closed') }] },
        { key: 'role', label: t('m26.changes.filterRole'), options: roles.map((r) => ({ value: r, label: m.roleName(r) })) },
        { key: 'area', label: t('m26.fx.filterArea'), options: [{ value: 'content', label: t('m26.fx.areaContent') }, { value: 'future', label: t('m26.fx.areaFuture') }] },
      ]} />
      {xs.length === 0 ? <EmptyState title={t('m26.changes.none')}>{t('m26.changes.noneBody')}</EmptyState> : (
        <ul className="space-y-3" data-testid="m26-changes">
          {xs.map((c) => {
            const items = d.items.filter((i) => i.change_id === c.id);
            const imp = c.impact as { courses: unknown[]; standards: unknown[]; jpms: { id: string; code: string }[]; items: { id: string }[] };
            const before = c.before as { title_en: string; title_ar: string; version: number };
            const after = c.after as { title_en: string; title_ar: string; version: number; status: string };
            return (
              <li key={c.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <L to={`/training/sat/tasks/${c.task_id}`} className="link font-semibold">{m.task.get(c.task_id)?.code}</L>
                    <span className="min-w-0">{pick(after, 'title')}</span>
                    <span className={`chip ${c.status === 'open' ? 'border-sim-line bg-sim-bg text-sim' : 'border-ok-line bg-ok-bg text-ok'}`}>{t(`m26.changes.status.${c.status}`)}</span>
                    <span className="chip border-line bg-sunken text-ink-2">{t(`m26.changes.kind.${c.kind}`)}</span>
                    {c.area === 'future' ? <span className="chip border-accent bg-accent-soft text-eyebrow">{t('m26.fx.areaFuture')}</span> : <span className="chip border-info-line bg-info-bg text-info">{t(`m26.changes.trigger.${c.trigger}`)}</span>}
                  </div>
                  <p className="mt-2 text-[13.5px]">{c.summary}</p>
                  {c.area === 'future' ? (<>
                    <FutureDiff before={c.before} after={c.after} />
                    <p className="mt-1 text-[12px] text-ink-3">{t('m26.changes.opened', { who: pick({ name_en: c.opened_by_name, name_ar: c.opened_by_name_ar }, 'name'), date: f.date(c.opened_at), role: m.roleName(c.role_id) })}</p>
                  </>) : (<>
                  {pick(before, 'title') !== pick(after, 'title') && <p className="mt-1 text-[12.5px] text-ink-2">{t('m26.changes.retitled', { from: pick(before, 'title'), v: f.num(after.version) })}</p>}
                  <p className="mt-1 text-[12px] text-ink-3">{t('m26.changes.opened', { who: pick({ name_en: c.opened_by_name, name_ar: c.opened_by_name_ar }, 'name'), date: f.date(c.opened_at), role: m.roleName(c.role_id) })}</p>
                  <p className="mt-1 text-[12px] text-ink-2">{t('m26.changes.impactLine', { c: f.num(imp.courses.length), s: f.num(imp.standards.length), j: f.num(imp.jpms.length), i: f.num(imp.items.length) })}</p>
                  {items.length === 0 ? <p className="mt-2 text-[12.5px] text-ink-3">{t('m26.changes.noItems')}</p> : (
                    <ul className="mt-3 divide-y divide-line rounded-card border border-line">
                      {items.map((it) => {
                        const succ = it.kind === 'standard' ? superseded(it.ref_id) : undefined;
                        return (
                          <li key={it.id} className="flex flex-wrap items-center gap-2 p-2.5 text-[13px]" data-testid="m26-change-item">
                            <span className="chip border-line bg-sunken text-ink-2">{t(`m26.changes.itemKind.${it.kind}`)}</span>
                            <span className="min-w-0 flex-1">{it.kind === 'standard' ? <L to={`/training/quals/${it.ref_id}`} className="link">{pick(it, 'title')}</L> : <L to={`/learn/course/${it.ref_id}`} className="link">{pick(it, 'title')}</L>}
                              {it.note && <span className="block text-[12px] text-ink-2">{it.note}</span>}
                              {it.revision_id && <span className="block text-[12px] text-ink-2">{t('m26.changes.revisedTo', { id: it.revision_id })}</span>}
                            </span>
                            <span className={`chip ${it.status === 'open' ? 'border-sim-line bg-sim-bg text-sim' : 'border-ok-line bg-ok-bg text-ok'}`}>{t(`m26.changes.itemStatus.${it.status}`)}</span>
                            {canW && it.status === 'open' && (
                              <span className="flex flex-wrap gap-1.5">
                                {it.kind === 'course' && <button className="btn-outline btn-sm" onClick={() => setAct({ item: it, kind: 'updated' })} data-testid="m26-item-updated">{t('m26.changes.markUpdated')}</button>}
                                {it.kind === 'standard' && !succ && canRevise && <button className="btn-outline btn-sm" onClick={() => setAct({ item: it, kind: 'revise_std' })} data-testid="m26-item-revise">{t('m26.changes.reviseStd')}</button>}
                                {it.kind === 'standard' && succ && <button className="btn-primary btn-sm" onClick={() => setAct({ item: it, kind: 'revised' })} data-testid="m26-item-revised">{t('m26.changes.markRevised')}</button>}
                                <button className="btn-ghost btn-sm" onClick={() => setAct({ item: it, kind: 'no_change' })}>{t('m26.changes.noChange')}</button>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  </>)}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Callout>{t('m26.changes.note')}</Callout>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)}
        title={act ? t(`m26.changes.confirm.${act.kind}`) : ''}
        consequence={act ? t(`m26.changes.confirmBody.${act.kind}`, { item: pick(act.item, 'title') }) : ''}
        requireReason={act?.kind === 'no_change' || act?.kind === 'revise_std'} reasonLabel={act?.kind === 'revise_std' ? t('m26.changes.reviseReason') : t('m26.changes.noChangeReason')}
        actingAs={t('m26.common.asStaff')} confirmLabel={act ? t(`m26.changes.confirm.${act.kind}`) : ''}
        onConfirm={async (reason) => {
          if (!act) return;
          if (act.kind === 'revise_std') { await run(() => repo.rpc.reviseStandard(act.item.ref_id, reason)); return; }
          await run(() => repo.rpc.resolveSatChangeItem(act.item.id, act.kind as 'updated' | 'revised' | 'no_change', reason));
        }} />
    </div>
  );
}

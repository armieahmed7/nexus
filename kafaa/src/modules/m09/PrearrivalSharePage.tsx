// FS69 /training/equivalency/prearrival/:shareId: one contractor's pre-arrival share as the ENEC evaluator sees it — the shared items
// only (never the rest of the passport), the link's expiry and consent, and the F33 pre-check run from those items. The check is
// guidance: it writes no skill evidence and no qualification status. Auditors read; evaluators run the check and revoke on request.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Async, EmptyState, ConfirmDialog, Callout, KeyValue, BenchmarkChips, SelectField, Section } from '../../ui';
import { useAction, useQuery, useRepo, type Result } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import type { PrearrivalCheck } from './prearrival';
import { GuidanceNote, ItemLine, PaStatus, PrecheckResult, SummaryLine } from './fs75ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function PrearrivalSharePage() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const { shareId } = useParams();
  const canRun = s.roles.includes('instructor') || s.roles.includes('training_manager');
  const q = useQuery(['prearrival_shares', 'record_shares'], async () => { const r = await repo.rpc.prearrivalShare(shareId ?? ''); return r.ok ? r.data! : null; }, [shareId]);
  const ref = useQuery(['task_items', 'skills', 'courses', 'qual_standards'], async () => {
    const [tasks, skills, courses, stds] = await Promise.all([repo.list('task_items', { order: [['sort', 'asc']] }), repo.list('skills'), repo.list('courses').catch(() => []), repo.list('qual_standards', { order: [['code', 'asc']] })]);
    return { tasks: tasks as Row[], skills: skills as Row[], courses: courses as Row[], stds: (stds as Row[]).filter((x) => x.status === 'current' && !x.security_restricted) };
  }, []);
  const [std, setStd] = useState('');
  const [res, setRes] = useState<Result<PrearrivalCheck> | null>(null);
  const [busy, setBusy] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const go = async (stdId: string) => {
    setBusy(true);
    try { setRes(await run(() => repo.rpc.precheckFromShare(shareId ?? '', stdId || null), {})); } finally { setBusy(false); }
  };
  return (
    <Page title={t('m09.routes.training-equivalency-prearrival-share.title')} eyebrow={t('m09.routes.training-equivalency-prearrival.title')}
      actions={<L to="/training/equivalency/prearrival" className="btn-ghost">{t('m09.pa.backQueue')}</L>}>
      <BenchmarkChips feature="FS69" />
      <Async state={q} isEmpty={(d) => !d} empty={<EmptyState title={t('m09.pa.notFoundTitle')}>{t('m09.pa.notFoundBody')}</EmptyState>}>
        {(d) => {
          const v = d!;
          const stdId = std || v.standard_id;
          const code = ref.data?.stds.find((x) => x.id === stdId)?.code ?? v.standard_code;
          return (
            <div className="space-y-5" data-testid="m09-pa-detail" data-status={v.status}>
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-semibold">{v.label}</h2><PaStatus status={v.status} />
                  <span className="chip border-line bg-sunken text-ink-2">{t(`m09.pa.via.${v.created_via}`)}</span>
                </div>
                <div className="mt-3">
                  <KeyValue items={[
                    [t('m09.pa.kHolder'), `${v.initials} · ${pick({ name_en: v.org_name_en, name_ar: v.org_name_ar }, 'name')}`],
                    [t('m09.pa.kStandard'), `${v.standard_code} · ${pick({ title_en: v.standard_title_en, title_ar: v.standard_title_ar }, 'title')}`],
                    [t('m09.pa.kMobilise'), f.date(v.mobilise_on)],
                    [t('m09.pa.kExpires'), f.date(v.expires_on)],
                    [t('m09.pa.kConsent'), v.created_via === 'on_behalf' ? t('m09.pa.consentBehalfVal', { ref: v.consent_ref }) : t('m09.pa.consentSelfVal')],
                    [t('m09.pa.kLast'), <SummaryLine key="s" s={v.check_summary} checkedAt={v.checked_at} />],
                  ]} />
                </div>
                {v.status === 'revoked' && v.revoke_reason && <p className="mt-2 text-[12.5px] text-ink-3">{t('m09.pa.revokedWhy', { why: v.revoke_reason })}</p>}
              </Card>
              {v.status !== 'active' ? (
                <Callout tone="sim" title={t(`m09.pa.closed.${v.status}`)}><span data-testid="m09-pa-closed">{t('m09.pa.closedBody')}</span></Callout>
              ) : (
                <>
                  <Section title={t('m09.pa.sharedTitle', { n: f.num(v.items.length) })} description={t('m09.pa.sharedDesc')}>
                    <Card>
                      <ul className="space-y-2" data-testid="m09-pa-shared">{v.items.map((it) => <li key={it.ref} data-testid="m09-pa-shared-item" data-ref={it.ref}><ItemLine it={it} /></li>)}</ul>
                    </Card>
                  </Section>
                  <GuidanceNote />
                  {canRun ? (
                    <Card>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[240px] flex-1">
                          <SelectField label={t('m09.cp.pcStandard')} name="std" value={stdId} onChange={(x) => { setStd(x); setRes(null); }}
                            options={(ref.data?.stds ?? []).map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'title')}` }))} />
                        </div>
                        <button type="button" className="btn-primary" disabled={busy} onClick={() => go(stdId)} data-testid="m09-pa-run">{busy ? t('m09.cp.pcRunning') : t('m09.pa.run')}</button>
                        <button type="button" className="btn-outline" onClick={() => setRevoke(true)} data-testid="m09-pa-eval-revoke">{t('m09.pa.revokeForContractor')}</button>
                      </div>
                    </Card>
                  ) : <p className="text-[12.5px] text-ink-3">{t('m09.pa.auditorNote')}</p>}
                  {res && !res.ok && <Callout tone="bad" title={t('m09.cp.pcRefused')}><span data-testid="m09-pa-refused" data-code={res.code}>{res.message}</span></Callout>}
                  {res?.ok && ref.data && <PrecheckResult p={res.data!} tasks={ref.data.tasks} skills={ref.data.skills} courses={ref.data.courses} stdCode={code} />}
                </>
              )}
              <ConfirmDialog open={revoke} onClose={() => setRevoke(false)} title={t('m09.pa.revokeTitle')} confirmLabel={t('m09.pa.revoke')} danger requireReason reasonLabel={t('m09.pa.revokeReason')}
                consequence={t('m09.pa.revokeEvalBody')}
                onConfirm={async (why) => { await run(() => repo.rpc.revokePrearrivalShare(v.id, why)); setRevoke(false); setRes(null); }} />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

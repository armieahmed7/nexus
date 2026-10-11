// M09 /partner/onboarding: the supplier's own readiness file. Readiness steps, self-assessment, document checklist with
// SHA-256 fingerprints, status tracking with history, then submission, which builds the readiness summary for ENEC's
// supplier registration. Partner admins edit; partner users (for example a contractor) follow the status read-only.
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Callout, Async, EmptyState, Tabs, Stepper, ProgressRing, ConfirmDialog, RadioGroup, KeyValue, Icon, DataTable, type Column } from '../../ui';
import { useT, usePick, useFormat, L, useNav } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { DOC_CHECKLIST, READINESS_STEPS, SELF_ASSESSMENT_AREAS, SELF_ASSESSMENT_MAX, SUPPLIER_STEPS, readinessState, selfAssessmentScore, type ReadinessStep } from '../../domain/partners';
import { HistoryTimeline, MStatus, fileFingerprint, shortHash, useMyOrg, useRoleName } from './shared';

type Case = RowOf<'partner_onboarding'>;
type Step = RowOf<'supplier_readiness'>;
type Doc = RowOf<'supplier_documents'>;
const EDITABLE = ['in_progress', 'returned'];

export default function PartnerOnboardingPage() {
  const t = useT();
  const repo = useRepo();
  const { orgId, org } = useMyOrg();
  const pick = usePick();
  const q = useQuery(['partner_onboarding', 'supplier_readiness', 'supplier_documents', 'icv_plans'], async () => {
    const [cases, steps, docs, icv] = await Promise.all([
      repo.list('partner_onboarding', { filter: { org_id: orgId ?? '' } }),
      repo.list('supplier_readiness', { filter: { org_id: orgId ?? '' } }),
      repo.list('supplier_documents', { filter: { org_id: orgId ?? '' } }),
      repo.list('icv_plans', { filter: { org_id: orgId ?? '' } }),
    ]);
    return { c: cases[0] ?? null, steps, docs, icv: icv[0] ?? null };
  }, [orgId]);
  return (
    <Page title={t('m09.routes.partner-onboarding.title')} eyebrow={org ? pick(org, 'name') : undefined} intro={t('m09.onb.intro')}>
      <Callout tone="info" title={t('m09.sup.prepTitle')}>{t('m09.onb.prepBody')}</Callout>
      <Async state={q} isEmpty={(d) => !d.c} empty={<EmptyState title={t('m09.onb.noCase')}>{t('m09.onb.noCaseBody')}</EmptyState>}>
        {(d) => <CaseView c={d.c!} steps={d.steps} docs={d.docs} icv={d.icv} />}
      </Async>
    </Page>
  );
}

function CaseView({ c, steps, docs, icv }: { c: Case; steps: Step[]; docs: Doc[]; icv: RowOf<'icv_plans'> | null }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const nav = useNav();
  const { isAdmin } = useMyOrg();
  const [params, setParams] = useSearchParams();
  const [confirm, setConfirm] = useState<null | 'start' | 'submit' | 'withdraw'>(null);
  const st = readinessState(steps, docs, icv);
  const supplier = c.kind === 'supplier';
  const canEdit = isAdmin && EDITABLE.includes(c.status);
  const closed = ['approved', 'handed_off'].includes(c.status);
  const stepStatus = (k: string) => (k === 'handoff' ? (c.status === 'handed_off' ? 'done' : 'not_started') : (steps.find((s) => s.step_key === k)?.status ?? 'not_started'));
  const current = Math.max(0, READINESS_STEPS.findIndex((k) => stepStatus(k) !== 'done'));
  const tab = params.get('tab') ?? 'path';

  const act = async (a: 'start' | 'submit' | 'withdraw') => {
    const r = await run(() => repo.rpc.partnerOnboardingAction(c.id, a));
    if (r.ok && a === 'submit') nav('/partner/onboarding/summary');
  };

  return (
    <>
      {c.status === 'returned' && <Callout tone="sim" title={t('m09.onb.returnedTitle')}>{c.decision_note || t('m09.onb.returnedBody')}</Callout>}
      {c.status === 'submitted' && <Callout tone="info" title={t('m09.onb.submittedTitle')}>{t('m09.onb.submittedBody')}</Callout>}
      {c.status === 'approved' && <Callout tone="ok" title={t('m09.onb.approvedTitle')}>{c.decision_note || t('m09.onb.approvedBody')}</Callout>}
      {c.status === 'handed_off' && <Callout tone="ok" title={t('m09.home.handedTitle')}>{t('m09.home.handedBody')}</Callout>}
      {!isAdmin && <Callout tone="info" title={t('m09.onb.readOnlyTitle')}>{t('m09.onb.readOnlyBody')}</Callout>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProgressRing value={closed ? 100 : st.pct} size={64} label={`${f.num(closed ? 100 : st.pct)}%`} />
            <div>
              <div className="caps">{t('m09.onb.caseStatus')}</div>
              <div className="flex items-center gap-2"><MStatus status={c.status} /><span className="num text-[12.5px] text-ink-3">{c.id}</span></div>
              {supplier && <div className="mt-1 text-[13px] text-ink-2">{t('m09.onb.progressLine', { steps: f.num(st.stepsDone), stepsTotal: f.num(st.stepsTotal), docs: f.num(st.docsReady), docsTotal: f.num(st.docsRequired) })}</div>}
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {c.status === 'invited' && <button className="btn-primary" onClick={() => setConfirm('start')} data-testid="m09-onb-start">{t('m09.onb.start')}</button>}
              {supplier && EDITABLE.includes(c.status) && (
                <button className="btn-primary" onClick={() => setConfirm('submit')} data-testid="m09-onb-submit" title={st.ready ? undefined : t('m09.onb.notReadyHint')}>
                  {t('m09.onb.submit')}
                </button>
              )}
              {c.status === 'submitted' && <button className="btn-outline" onClick={() => setConfirm('withdraw')} data-testid="m09-onb-withdraw">{t('m09.onb.withdraw')}</button>}
              {c.summary && Object.keys(c.summary as object).length > 0 && <L to="/partner/onboarding/summary" className="btn-outline" data-testid="m09-onb-summary">{t('m09.onb.viewSummary')}</L>}
            </div>
          )}
          {!isAdmin && c.summary && Object.keys(c.summary as object).length > 0 && <L to="/partner/onboarding/summary" className="btn-outline">{t('m09.onb.viewSummary')}</L>}
        </div>
        {supplier && (
          <div className="mt-4 overflow-x-auto">
            <Stepper steps={READINESS_STEPS.map((k) => ({ id: k, label: t(`m09.step.${k}`) }))} current={closed && c.status === 'handed_off' ? READINESS_STEPS.length : current} />
          </div>
        )}
      </Card>

      {supplier ? (
        <Tabs
          value={tab}
          onChange={(id) => { const p = new URLSearchParams(params); p.set('tab', id); setParams(p, { replace: true }); }}
          tabs={[
            { id: 'path', label: t('m09.onb.tab.path'), content: <PathTab c={c} steps={steps} docs={docs} icv={icv} canEdit={canEdit} /> },
            { id: 'self', label: t('m09.onb.tab.self'), content: <SelfTab c={c} steps={steps} canEdit={canEdit} /> },
            { id: 'documents', label: t('m09.onb.tab.documents'), badge: st.missingDocs.length + st.rejectedDocs.length || undefined, content: <DocsTab c={c} docs={docs} canEdit={isAdmin && ['invited', 'in_progress', 'returned'].includes(c.status)} /> },
            { id: 'status', label: t('m09.onb.tab.status'), content: <StatusTab c={c} /> },
          ]}
        />
      ) : (
        <Card title={t('m09.onb.tab.status')}>
          <p className="mb-3 text-[13px] text-ink-2">{t('m09.onb.nonSupplier')}</p>
          <StatusTab c={c} />
        </Card>
      )}

      <ConfirmDialog
        open={confirm === 'start'}
        onClose={() => setConfirm(null)}
        title={t('m09.onb.start')}
        consequence={t('m09.onb.startBody')}
        actingAs={t('m09.home.roleAdmin')}
        onConfirm={() => act('start')}
      />
      <ConfirmDialog
        open={confirm === 'withdraw'}
        onClose={() => setConfirm(null)}
        title={t('m09.onb.withdraw')}
        consequence={t('m09.onb.withdrawBody')}
        actingAs={t('m09.home.roleAdmin')}
        onConfirm={() => act('withdraw')}
      />
      <ConfirmDialog
        open={confirm === 'submit'}
        onClose={() => setConfirm(null)}
        title={t('m09.onb.submit')}
        consequence={st.ready ? t('m09.onb.submitBody') : t('m09.onb.submitNotReady')}
        actingAs={t('m09.home.roleAdmin')}
        confirmLabel={t('m09.onb.submitConfirm')}
        onConfirm={() => act('submit')}
      >
        <ul className="space-y-1 text-[13px]" data-testid="m09-onb-checklist">
          <Check ok={st.missingSteps.length === 0} label={t('m09.onb.chk.steps', { n: f.num(st.missingSteps.length) })} />
          <Check ok={st.missingDocs.length === 0} label={t('m09.onb.chk.docs', { n: f.num(st.missingDocs.length) })} />
          <Check ok={st.rejectedDocs.length === 0} label={t('m09.onb.chk.rejected', { n: f.num(st.rejectedDocs.length) })} />
          <Check ok={st.icvReady} label={t('m09.onb.chk.icv')} />
        </ul>
      </ConfirmDialog>
    </>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-ok' : 'text-bad'}`}>
      <Icon name={ok ? 'check' : 'alert'} size={14} />
      <span className="text-ink">{label}</span>
    </li>
  );
}

const STEP_LINKS: Record<string, { to: string; key: string; external?: boolean }[]> = {
  orientation: [{ to: 'https://www.enec.ae/vendors/vendor-education/potential-opportunities-in-the-project/localization-opportunities/', key: 'localisation', external: true }, { to: '/suppliers', key: 'suppliers' }],
  quality: [{ to: '/partner/academy', key: 'academyQuality' }],
  safety_culture: [{ to: '/partner/academy', key: 'academySafety' }, { to: '/safety-culture', key: 'traits' }],
  icv: [{ to: '/partner/icv', key: 'icvPlan' }, { to: 'https://www.enec.ae/vendors/vendor-education/icv/', key: 'icvSource', external: true }],
  self_assessment: [{ to: '?tab=self', key: 'selfTab' }],
};

function PathTab({ c, steps, docs, icv, canEdit }: { c: Case; steps: Step[]; docs: Doc[]; icv: RowOf<'icv_plans'> | null; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const sa = (steps.find((s) => s.step_key === 'self_assessment')?.self_assessment ?? {}) as Record<string, number>;
  const blocker = (k: ReadinessStep): string | null => {
    const need = DOC_CHECKLIST.filter((d) => d.step === k && d.required && !['uploaded', 'accepted'].includes(docs.find((x) => x.doc_key === d.key)?.status ?? 'missing'));
    if (need.length) return t('m09.onb.blockDocs', { n: f.num(need.length) });
    if (k === 'icv' && (!icv || icv.status === 'draft')) return t('m09.onb.blockIcv');
    if (k === 'self_assessment' && SELF_ASSESSMENT_AREAS.some((a) => !(sa[a] > 0))) return t('m09.onb.blockSelf');
    return null;
  };
  const setStatus = async (k: ReadinessStep, status: 'not_started' | 'in_progress' | 'done') => {
    const row = steps.find((s) => s.step_key === k);
    const patch = { status, updated_at: new Date().toISOString() };
    await run(() => (row ? repo.update('supplier_readiness', row.id, patch) : repo.insert('supplier_readiness', { id: `sr-${c.org_id}-${k}`, org_id: c.org_id, step_key: k, ...patch })), { success: t('m09.onb.stepSaved') });
  };
  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m09-onb-steps">
      {SUPPLIER_STEPS.map((k, i) => {
        const row = steps.find((s) => s.step_key === k);
        const status = row?.status ?? 'not_started';
        const b = blocker(k);
        const stepDocs = DOC_CHECKLIST.filter((d) => d.step === k);
        return (
          <li key={k} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="caps">{t('m09.sup.stepN', { n: i + 1 })}</div>
                <h3 className="font-semibold">{t(`m09.step.${k}`)}</h3>
              </div>
              <MStatus status={status} />
            </div>
            <p className="mt-1 text-[13px] text-ink-2">{t(`m09.onb.stepBody.${k}`)}</p>
            {stepDocs.length > 0 && (
              <p className="mt-2 text-[12.5px] text-ink-3">
                {t('m09.onb.stepDocs')}: {stepDocs.map((d) => t(`m09.doc.${d.key}`)).join(' · ')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
              {(STEP_LINKS[k] ?? []).map((l) =>
                l.external ? (
                  <a key={l.key} href={l.to} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">{t(`m09.onb.link.${l.key}`)} <Icon name="external" size={12} /></a>
                ) : l.to.startsWith('?') ? (
                  <L key={l.key} to={`/partner/onboarding${l.to}`}>{t(`m09.onb.link.${l.key}`)}</L>
                ) : (
                  <L key={l.key} to={l.to}>{t(`m09.onb.link.${l.key}`)}</L>
                ),
              )}
            </div>
            {canEdit && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {status !== 'in_progress' && status !== 'done' && <button className="btn-outline btn-sm" onClick={() => setStatus(k, 'in_progress')}>{t('m09.onb.markProgress')}</button>}
                {status !== 'done' && (
                  <button className="btn-primary btn-sm" disabled={!!b} onClick={() => setStatus(k, 'done')} data-testid={`m09-onb-done-${k}`}>{t('m09.onb.markDone')}</button>
                )}
                {status === 'done' && <button className="btn-ghost btn-sm" onClick={() => setStatus(k, 'in_progress')}>{t('m09.onb.reopen')}</button>}
                {b && status !== 'done' && <span className="text-[12px] text-ink-3">{b}</span>}
              </div>
            )}
            {row?.updated_at && <div className="mt-2 text-[11.5px] text-ink-3">{t('m09.onb.updated', { date: f.dateTime(row.updated_at) })}</div>}
          </li>
        );
      })}
      <li className="card border-dashed p-4">
        <div className="caps">{t('m09.sup.stepN', { n: 6 })}</div>
        <h3 className="font-semibold">{t('m09.step.handoff')}</h3>
        <p className="mt-1 text-[13px] text-ink-2">{t('m09.onb.stepBody.handoff')}</p>
        <div className="mt-2"><MStatus status={c.status === 'handed_off' ? 'done' : 'not_started'} /></div>
      </li>
    </ol>
  );
}

function SelfTab({ c, steps, canEdit }: { c: Case; steps: Step[]; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const row = steps.find((s) => s.step_key === 'self_assessment');
  const initial = (row?.self_assessment ?? {}) as Record<string, number>;
  const [vals, setVals] = useState<Record<string, number>>(initial);
  const score = selfAssessmentScore(vals);
  const dirty = JSON.stringify(vals) !== JSON.stringify(initial);
  const save = async () => {
    const patch = { self_assessment: vals as never, status: (row?.status === 'done' ? 'done' : 'in_progress') as Step['status'], updated_at: new Date().toISOString() };
    await run(() => (row ? repo.update('supplier_readiness', row.id, patch) : repo.insert('supplier_readiness', { id: `sr-${c.org_id}-self_assessment`, org_id: c.org_id, step_key: 'self_assessment', ...patch })), { success: t('m09.onb.selfSaved') });
  };
  return (
    <div className="space-y-4">
      <Callout tone="info" title={t('m09.onb.selfTitle')}>{t('m09.onb.selfBody')}</Callout>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m09-onb-self">
        {SELF_ASSESSMENT_AREAS.map((a) => (
          <Card key={a}>
            <RadioGroup
              label={<span>{t(`m09.self.${a}.title`)}<span className="block text-[12px] font-normal text-ink-3">{t(`m09.self.${a}.q`)}</span></span>}
              name={`sa-${a}`}
              value={String(vals[a] ?? '')}
              onChange={(v) => canEdit && setVals((x) => ({ ...x, [a]: Number(v) }))}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: <span><span className="num font-semibold">{f.num(n)}</span> · {t(`m09.self.level${n}`)}</span> }))}
            />
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px]">{t('m09.onb.selfScore')}: <span className="num font-semibold">{score == null ? '—' : `${f.num(score)} / ${f.num(SELF_ASSESSMENT_MAX)}`}</span></span>
        {canEdit && <button className="btn-primary" disabled={!dirty} onClick={save} data-testid="m09-onb-self-save">{t('common.save')}</button>}
        {!canEdit && <span className="text-[12.5px] text-ink-3">{t('m09.onb.lockedHint')}</span>}
      </div>
    </div>
  );
}

function DocsTab({ c, docs, canEdit }: { c: Case; docs: Doc[]; canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = useMemo(() => DOC_CHECKLIST.map((d) => ({ def: d, row: docs.find((x) => x.doc_key === d.key) ?? null })), [docs]);
  type R = (typeof rows)[number];
  const pickFile = (key: string) => {
    setTarget(key);
    input.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    if (!file || !target) return;
    setBusy(target);
    try {
      const fp = await fileFingerprint(file);
      await run(() => repo.rpc.uploadSupplierDocument(c.org_id, target, fp.name, fp.sizeKb, fp.sha256), { success: t('m09.onb.docSaved') });
    } finally {
      setBusy(null);
      setTarget(null);
      if (input.current) input.current.value = '';
    }
  };
  const cols: Column<R>[] = [
    { key: 'doc', header: t('m09.onb.col.document'), value: (r) => t(`m09.doc.${r.def.key}`), render: (r) => <div><div className="font-semibold">{t(`m09.doc.${r.def.key}`)}</div><div className="text-[12px] text-ink-3">{t(`m09.doc.${r.def.key}_hint`)}</div></div> },
    { key: 'step', header: t('m09.onb.col.step'), value: (r) => t(`m09.step.${r.def.step}`) },
    { key: 'req', header: t('m09.onb.col.required'), value: (r) => (r.def.required ? t('common.yes') : t('m09.onb.optional')) },
    { key: 'status', header: t('m09.onb.col.status'), value: (r) => r.row?.status ?? 'missing', render: (r) => <MStatus status={r.row?.status ?? 'missing'} /> },
    { key: 'file', header: t('m09.onb.col.file'), value: (r) => r.row?.file_name ?? '', render: (r) => r.row?.file_name ? <div><div className="ltr text-[12.5px]">{r.row.file_name}</div><div className="num text-[11.5px] text-ink-3" title={r.row.sha256 ?? ''}>{r.row.size_kb != null ? `${f.num(r.row.size_kb)} KB · ` : ''}SHA-256 {shortHash(r.row.sha256)}</div></div> : '—' },
    { key: 'review', header: t('m09.onb.col.review'), value: (r) => r.row?.review_note ?? '', render: (r) => r.row?.review_note ? <span className={r.row.status === 'rejected' ? 'text-bad' : 'text-ink-2'}>{r.row.review_note}</span> : '—' },
    {
      key: 'act', header: '', csv: false,
      render: (r) => canEdit ? (
        <button className="btn-outline btn-sm" disabled={busy === r.def.key} onClick={() => pickFile(r.def.key)} data-testid={`m09-onb-upload-${r.def.key}`}>
          <Icon name="plus" size={12} /> {busy === r.def.key ? t('common.working') : r.row?.status && r.row.status !== 'missing' ? t('m09.onb.replace') : t('m09.onb.upload')}
        </button>
      ) : null,
    },
  ];
  return (
    <div className="space-y-3">
      <Callout tone="info" title={t('m09.onb.docsTitle')}>{t('m09.onb.docsBody')}</Callout>
      {!canEdit && <p className="text-[12.5px] text-ink-3">{t('m09.onb.docsLocked')}</p>}
      <input ref={input} type="file" className="sr-only" aria-label={t('m09.onb.upload')} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" onChange={(e) => onFile(e.target.files?.[0])} tabIndex={-1} />
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.def.key} csvName="kafaa-supplier-documents" searchable={false} pageSize={20} caption={t('m09.onb.tab.documents')} />
    </div>
  );
}

function StatusTab({ c }: { c: Case }) {
  const t = useT();
  const f = useFormat();
  const roleName = useRoleName();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
      <Card title={t('m09.onb.caseFacts')}>
        <KeyValue items={[
          [t('m09.onb.caseStatus'), <MStatus key="s" status={c.status} />],
          [t('m09.onb.started'), f.date(c.started_at)],
          [t('m09.onb.submitted'), c.submitted_at ? f.dateTime(c.submitted_at) : '—'],
          [t('m09.onb.decided'), c.decided_at ? f.dateTime(c.decided_at) : '—'],
          [t('m09.onb.decisionNote'), c.decision_note || '—'],
          [t('m09.onb.handoff'), c.nexus_handoff_ref ? <span key="h" className="ltr">{t('m09.onb.handoffRef', { ref: c.nexus_handoff_ref })}</span> : '—'],
          [t('m09.onb.decider'), c.decided_by ? roleName('admin') : '—'],
        ]} />
      </Card>
      <Card title={t('m09.onb.history')}>
        <HistoryTimeline history={c.history} />
      </Card>
    </div>
  );
}


// M13 · Dalil administration: kill switch (AI owner), approved corpus, refusal policies, the evaluation set with
// release thresholds, conversation logs with retention, and the human hand-off queue. Editors curate; the admin
// (AI owner) switches Dalil; auditors read.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, usePick, useT } from '../../i18n';
import { Async, BarChart, Callout, Card, CheckboxField, DataTable, Drawer, EmptyState, FilterBar, Icon, KeyValue, LineChart, Modal, Page, SelectField, StatusPill, Tabs, TextArea, TextField, required, minLen, useFilters, useForm, type Column } from '../../ui';
import type { AdvisorSessionsRow, CorpusDocsRow, EvalRunsRow, RefusalPoliciesRow } from '../../data/types';
import { GatedConfirm, Metric } from '../m16/parts';
import { buildCorpus } from './dalil/corpus';
import { createEngine, GuardedEngine, ModelGatewayEngine, RetrievalEngine } from './dalil/engine';
import { CITATION_FLOOR, EVAL_SET, runEval, type EvalSummary } from './dalil/evalset';
import { CAREER_EVAL_SET, evalCareerCtx, runCareerEval, type CareerEvalSummary } from './career/evalset'; // W5E5 (F37)
import { CareerEngine } from './career/engine';
import { LOCKED_CATEGORIES, FLOOR_PATTERN_COUNT } from './dalil/guard';
import { todayIso } from '../../domain/rules';

export default function AdminDalilPage() {
  const t = useT();
  const s = useSession();
  const canKill = s.can('dalil_config', ['A']);
  const canEdit = s.can('dalil_config', ['W', 'A']);
  const role = canKill ? t('m13.admin.roleOwner') : canEdit ? t('m13.admin.roleEditor') : t('m13.admin.roleAuditor');
  return (
    <Page title={t('m13.routes.admin-dalil.title')} intro={t('m13.admin.intro')} actions={<StatusPill tone="neutral">{role}</StatusPill>}>
      <Tabs
        tabs={[
          { id: 'overview', label: t('m13.admin.tabOverview'), content: <Overview canKill={canKill} /> },
          { id: 'corpus', label: t('m13.admin.tabCorpus'), content: <CorpusTab canEdit={canEdit} /> },
          { id: 'policies', label: t('m13.admin.tabPolicies'), content: <PoliciesTab canEdit={canEdit} /> },
          { id: 'eval', label: t('m13.admin.tabEval'), content: <EvalTab canEdit={canEdit} /> },
          { id: 'logs', label: t('m13.admin.tabLogs'), content: <LogsTab /> },
          { id: 'handoffs', label: t('m13.admin.tabHandoffs'), content: <HandoffsTab /> },
        ]}
      />
    </Page>
  );
}

// ───────────── Overview and kill switch
function Overview({ canKill }: { canKill: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [confirm, setConfirm] = useState(false);
  const data = useQuery(['dalil_settings', 'advisor_sessions', 'advisor_turns', 'eval_runs'], async () => {
    const [settings, sessions, turns, evals] = await Promise.all([repo.list('dalil_settings'), repo.list('advisor_sessions'), repo.list('advisor_turns'), repo.list('eval_runs', { order: [['run_at', 'desc']] })]);
    return { settings, sessions, turns, evals };
  });
  return (
    <Async state={data} isEmpty={(d) => d.settings.length === 0}>
      {(d) => {
        const st = d.settings[0];
        const dalilTurns = d.turns.filter((x) => x.speaker === 'dalil');
        const refused = dalilTurns.filter((x) => x.refused);
        const cats = [...new Set(refused.map((x) => x.refusal_category ?? 'other'))];
        const last = d.evals[0];
        return (
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3" data-testid="m13-killswitch">
                <div>
                  <div className="caps">{t('m13.admin.killTitle')}</div>
                  <div className="mt-1 flex items-center gap-2 text-[18px] font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full ${st.enabled ? 'bg-ok' : 'bg-bad'}`} aria-hidden />
                    {st.enabled ? t('m13.admin.on') : t('m13.admin.off')}
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2">{t('m13.admin.killHelp')}</p>
                  {st.updated_at && <p className="text-[12px] text-ink-3">{t('m13.admin.lastChange', { when: f.dateTime(st.updated_at) })}</p>}
                </div>
                {canKill ? (
                  <button className={st.enabled ? 'btn-danger' : 'btn-primary'} onClick={() => setConfirm(true)} data-testid="m13-kill-toggle">
                    {st.enabled ? t('m13.admin.turnOff') : t('m13.admin.turnOn')}
                  </button>
                ) : (
                  <StatusPill tone="neutral">{t('m13.admin.ownerOnly')}</StatusPill>
                )}
              </div>
            </Card>
            <GatedConfirm
              open={confirm}
              onClose={() => setConfirm(false)}
              danger={st.enabled}
              title={st.enabled ? t('m13.admin.turnOff') : t('m13.admin.turnOn')}
              consequence={st.enabled ? t('m13.admin.offConsequence') : t('m13.admin.onConsequence')}
              actingAs={t('m13.admin.roleOwner')}
              onConfirm={() => run(() => repo.rpc.setDalilEnabled(!st.enabled))}
            />
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label={t('m13.admin.mSessions')} value={f.num(d.sessions.length)} />
              <Metric label={t('m13.admin.mAnswers')} value={f.num(dalilTurns.length)} />
              <Metric label={t('m13.admin.mRefusals')} value={f.pct(dalilTurns.length ? (refused.length * 100) / dalilTurns.length : 0, 0)} />
              <Metric label={t('m13.admin.mHandoffs')} value={f.num(d.sessions.filter((x) => x.handoff_status === 'requested').length)} tone={d.sessions.some((x) => x.handoff_status === 'requested') ? 'info' : undefined} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card title={t('m13.admin.settingsTitle')}>
                <KeyValue
                  items={[
                    [t('m13.admin.engine'), <code key="e" className="ltr">{st.engine}</code>],
                    [t('m13.admin.gateway'), st.model_gateway],
                    [t('m13.admin.publicLimit'), t('m13.admin.perHour', { n: f.num(st.public_rate_limit_per_hour) })],
                    [t('m13.admin.signedInLimit'), t('m13.admin.perHour', { n: f.num(st.signed_in_rate_limit_per_hour) })],
                    [t('m13.admin.retention'), t('m13.admin.days', { n: f.num(st.retention_days) })],
                    [t('m13.admin.staffMode'), st.staff_mode ? t('common.yes') : t('common.no')],
                  ]}
                />
                <p className="mt-3 text-[12px] text-ink-3">{t('m13.admin.settingsNote')}</p>
              </Card>
              <Card title={t('m13.admin.refusalsByCat')}>
                {refused.length === 0 ? <p className="text-[13px] text-ink-3">{t('m13.admin.noRefusals')}</p> : <BarChart title={t('m13.admin.refusalsByCat')} data={cats.map((c) => ({ label: t(`m13.cat.${c}`), value: refused.filter((x) => (x.refusal_category ?? 'other') === c).length }))} />}
              </Card>
            </div>
            {last && (
              <Callout tone={last.pass ? 'ok' : 'bad'} title={t(last.pass ? 'm13.admin.gateOpen' : 'm13.admin.gateBlocked', { release: last.release })}>
                {t('m13.admin.lastEval', { when: f.dateTime(last.run_at), cite: f.pct((last.cited_correct * 100) / Math.max(1, last.in_scope_total)), ref: f.pct((last.refusal_correct * 100) / Math.max(1, last.refusal_total)) })}
              </Callout>
            )}
          </div>
        );
      }}
    </Async>
  );
}

// ───────────── Corpus
function CorpusTab({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const docs = useQuery('corpus_docs', () => repo.list('corpus_docs', { order: [['title', 'asc']] }));
  const structured = useQuery(['job_roles', 'talent_programmes', 'faqs', 'facts', 'corpus_docs'], () => buildCorpus(repo, { signedIn: false, personId: null }));
  const [flt, setFlt] = useFilters({ kind: '', approved: '' });
  const [adding, setAdding] = useState(false);
  const [toggle, setToggle] = useState<CorpusDocsRow | null>(null);
  const [probe, setProbe] = useState({ q: '', mode: 'public' });
  const [probeOut, setProbeOut] = useState<string | null>(null);
  const rows = (docs.data ?? []).filter((d) => (!flt.kind || d.kind === flt.kind) && (!flt.approved || String(d.approved) === flt.approved));
  const cols: Column<CorpusDocsRow>[] = [
    { key: 'title', header: t('m13.admin.docTitle'), value: (r) => r.title, sortable: true, render: (r) => <span className="font-semibold">{r.title}</span> },
    { key: 'kind', header: t('m13.admin.kind'), value: (r) => r.kind, render: (r) => <StatusPill tone="neutral">{t(`m13.admin.kinds.${r.kind}`)}</StatusPill> },
    { key: 'modes', header: t('m13.admin.modes'), value: (r) => r.modes.join(', '), render: (r) => <span className="text-[12px]">{r.modes.map((m) => t(`m13.modes.${m}`)).join(' · ')}</span> },
    { key: 'public', header: t('m13.admin.public'), value: (r) => (r.is_public ? 'yes' : 'no'), render: (r) => (r.is_public ? <StatusPill tone="ok">{t('common.yes')}</StatusPill> : <StatusPill tone="neutral">{t('m13.admin.internal')}</StatusPill>) },
    { key: 'approved', header: t('m13.admin.approved'), value: (r) => (r.approved ? 'yes' : 'no'), render: (r) => <StatusPill status={r.approved ? 'approved' : 'withdrawn'}>{r.approved ? t('m13.admin.approvedYes') : t('m13.admin.approvedNo')}</StatusPill> },
    { key: 'updated', header: t('m13.admin.updated'), value: (r) => r.updated_at, sortable: true, render: (r) => f.date(r.updated_at) },
    ...(canEdit ? [{ key: 'act', header: '', csv: false, render: (r: CorpusDocsRow) => <button className="btn-ghost btn-sm" onClick={() => setToggle(r)}>{r.approved ? t('m13.admin.withdraw') : t('m13.admin.approve')}</button> } as Column<CorpusDocsRow>] : []),
  ];
  return (
    <div className="space-y-4">
      <Callout tone="info">{t('m13.admin.corpusIntro')}</Callout>
      <Async state={structured}>
        {(c) => (
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label={t('m13.admin.docsPublic')} value={f.num(c.docs.length)} sub={t('m13.admin.docsPublicSub')} />
            <Metric label={t('m13.admin.roles')} value={f.num(c.docs.filter((d) => d.kind === 'role').length)} />
            <Metric label={t('m13.admin.programmes')} value={f.num(c.docs.filter((d) => d.kind === 'programme').length)} />
            <Metric label={t('m13.admin.faqFacts')} value={f.num(c.docs.filter((d) => d.kind === 'faq' || d.kind === 'fact').length)} />
          </div>
        )}
      </Async>
      <FilterBar
        value={flt}
        onChange={setFlt}
        fields={[
          { key: 'kind', label: t('m13.admin.kind'), options: ['kafaa_page', 'enec_page', 'fanr_page', 'internal'].map((x) => ({ value: x, label: t(`m13.admin.kinds.${x}`) })) },
          { key: 'approved', label: t('m13.admin.approved'), options: [{ value: 'true', label: t('m13.admin.approvedYes') }, { value: 'false', label: t('m13.admin.approvedNo') }] },
        ]}
        extra={canEdit ? <button className="btn-primary btn-sm self-end" onClick={() => setAdding(true)} data-testid="m13-add-doc"><Icon name="plus" />{t('m13.admin.addDoc')}</button> : undefined}
      />
      <Async state={docs}>
        {() => <div data-testid="m13-corpus-table"><DataTable rows={rows} rowKey={(r) => r.id} columns={cols} csvName="dalil-corpus" /></div>}
      </Async>
      <Card title={t('m13.admin.probeTitle')}>
        <p className="mb-2 text-[12.5px] text-ink-2">{t('m13.admin.probeHelp')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[240px] flex-1">
            <span className="caps">{t('m13.admin.probeQ')}</span>
            <input className="input mt-1" value={probe.q} onChange={(e) => setProbe({ ...probe, q: e.target.value })} data-testid="m13-probe-q" />
          </label>
          <label>
            <span className="caps">{t('m13.ask.mode')}</span>
            <select className="input mt-1" value={probe.mode} onChange={(e) => setProbe({ ...probe, mode: e.target.value })}>
              {['public', 'applicant', 'staff', 'partner'].map((m) => <option key={m} value={m}>{t(`m13.modes.${m}`)}</option>)}
            </select>
          </label>
          <button
            className="btn-outline"
            disabled={!probe.q.trim()}
            onClick={async () => {
              const c = await buildCorpus(repo, { signedIn: true, personId: s.identity.personId, orgId: s.identity.orgId });
              const a = await createEngine('retrieval-v1').answer({ question: probe.q, lang: /[؀-ۿ]/.test(probe.q) ? 'ar' : 'en', mode: probe.mode as never }, c);
              setProbeOut(`${a.refused ? `[${t('m13.ask.outOfScope')}: ${a.refusalCategory}] ` : ''}${a.text}\n${(a.bullets ?? []).map((b) => `• ${b}`).join('\n')}\n${t('m13.ask.sources')}: ${a.citations.map((x) => x.label).join(' | ') || '—'} (${a.intent}, ${f.num(a.confidence, { maximumFractionDigits: 2 })})`);
            }}
            data-testid="m13-probe-run"
          >
            {t('m13.admin.probeRun')}
          </button>
        </div>
        {probeOut && <pre className="mt-3 whitespace-pre-wrap rounded-btn bg-sunken p-3 text-[12.5px]" data-testid="m13-probe-out">{probeOut}</pre>}
      </Card>
      <GatedConfirm
        open={!!toggle}
        onClose={() => setToggle(null)}
        title={toggle?.approved ? t('m13.admin.withdraw') : t('m13.admin.approve')}
        consequence={toggle?.approved ? t('m13.admin.withdrawBody', { title: toggle?.title ?? '' }) : t('m13.admin.approveBody', { title: toggle?.title ?? '' })}
        actingAs={t('m13.admin.roleEditor')}
        onConfirm={() => toggle && run(() => repo.update('corpus_docs', toggle.id, { approved: !toggle.approved, updated_at: new Date().toISOString() }), { success: t('m13.admin.saved') })}
      />
      <AddDoc open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddDoc({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [modes, setModes] = useState<string[]>(['staff']);
  const [isPublic, setPublic] = useState(false);
  const form = useForm({ title: '', url: '', kind: 'internal', text_en: '', text_ar: '' }, { title: [required()], kind: [required()], text_en: [required(), minLen(40)], text_ar: [required()] });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('m13.admin.addDoc')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={form.submitting || modes.length === 0}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.insert('corpus_docs', { ...v, url: v.url || null, kind: v.kind as never, modes, is_public: isPublic, approved: true, updated_at: new Date().toISOString() }), { success: t('m13.admin.saved') });
              if (r.ok) {
                form.reset();
                onClose();
              }
            })}
            data-testid="m13-doc-save"
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Callout tone="sim" title={t('m13.admin.docRulesTitle')}>{t('m13.admin.docRules')}</Callout>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('m13.admin.docTitle')} required {...form.field('title')} />
          <TextField label={t('m13.admin.url')} {...form.field('url')} hint={t('m13.admin.urlHint')} />
          <SelectField label={t('m13.admin.kind')} required options={['kafaa_page', 'enec_page', 'fanr_page', 'internal'].map((x) => ({ value: x, label: t(`m13.admin.kinds.${x}`) }))} {...form.field('kind')} />
        </div>
        <TextArea label={t('m13.admin.textEn')} required rows={4} {...form.field('text_en')} />
        <TextArea label={t('m13.admin.textAr')} required rows={3} {...form.field('text_ar')} />
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold">{t('m13.admin.modes')}</legend>
          <div className="flex flex-wrap gap-4">
            {['public', 'applicant', 'staff', 'partner'].map((m) => (
              <CheckboxField key={m} label={t(`m13.modes.${m}`)} checked={modes.includes(m)} onChange={(v) => setModes((xs) => (v ? [...xs, m] : xs.filter((x) => x !== m)))} />
            ))}
          </div>
        </fieldset>
        <CheckboxField label={t('m13.admin.isPublic')} hint={t('m13.admin.isPublicHint')} checked={isPublic} onChange={setPublic} />
      </div>
    </Modal>
  );
}

// ───────────── Refusal policies
function PoliciesTab({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const pols = useQuery('refusal_policies', () => repo.list('refusal_policies', { order: [['category', 'asc']] }));
  const [edit, setEdit] = useState<RefusalPoliciesRow | null>(null);
  return (
    <div className="space-y-4">
      <Callout tone="info">{t('m13.admin.policiesIntro')}</Callout>
      <Async state={pols}>
        {(rows) => (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="m13-policies">
            {rows.map((p) => {
              const locked = LOCKED_CATEGORIES.includes(p.category);
              return (
                <li key={p.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{t(`m13.cat.${p.category}`)}</div>
                    <div className="flex flex-wrap gap-1">
                      {p.stop_conversation && <StatusPill tone="accent">{t('m13.admin.stops')}</StatusPill>}
                      {locked && <StatusPill tone="reserved">{t('m13.admin.floor', { n: FLOOR_PATTERN_COUNT[p.category] ?? 0 })}</StatusPill>}
                      <StatusPill status={p.enabled ? 'active' : 'suspended'}>{p.enabled ? t('m13.admin.enabled') : t('m13.admin.disabled')}</StatusPill>
                    </div>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2">{pick(p, 'description')}</p>
                  <p className="mt-2 rounded-btn bg-sunken p-2 text-[12.5px]">{pick(p, 'response')}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.patterns.map((x) => <code key={x} className="rounded border border-line px-1 text-[11.5px]">{x}</code>)}
                  </div>
                  {canEdit && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-outline btn-sm" onClick={() => setEdit(p)}>{t('common.edit')}</button>
                      {!locked && (
                        <button className="btn-ghost btn-sm" onClick={() => run(() => repo.update('refusal_policies', p.id, { enabled: !p.enabled }), { success: t('m13.admin.saved') })}>
                          {p.enabled ? t('m13.admin.disable') : t('m13.admin.enable')}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      {edit && <EditPolicy p={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditPolicy({ p, onClose }: { p: RefusalPoliciesRow; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ patterns: p.patterns.join('\n'), response_en: p.response_en, response_ar: p.response_ar }, { response_en: [required()], response_ar: [required()] });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('m13.admin.editPolicy', { cat: t(`m13.cat.${p.category}`) })}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            onClick={form.handleSubmit(async (v) => {
              const patterns = v.patterns.split('\n').map((x) => x.trim()).filter((x) => x.length >= 3);
              const r = await run(() => repo.update('refusal_policies', p.id, { patterns, response_en: v.response_en, response_ar: v.response_ar }), { success: t('m13.admin.saved') });
              if (r.ok) onClose();
            })}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <TextArea label={t('m13.admin.patterns')} rows={5} {...form.field('patterns')} hint={t('m13.admin.patternsHint')} />
        <TextArea label={t('m13.admin.responseEn')} rows={3} required {...form.field('response_en')} />
        <TextArea label={t('m13.admin.responseAr')} rows={3} required {...form.field('response_ar')} />
      </div>
    </Modal>
  );
}

// ───────────── Evaluation
function EvalTab({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const runs = useQuery('eval_runs', () => repo.list('eval_runs', { order: [['run_at', 'asc']] }));
  const [result, setResult] = useState<EvalSummary | null>(null);
  const [career, setCareer] = useState<CareerEvalSummary | null>(null); // W5E5 (F37): the career-mode set is part of the release gate
  const [busy, setBusy] = useState(false);
  const [only, setOnly] = useState<'all' | 'fail'>('all');
  const start = async () => {
    setBusy(true);
    try {
      // Evaluate exactly what an anonymous visitor's Dalil would see (public corpus, public mode).
      const settings = await repo.list('dalil_settings');
      const c = await buildCorpus(repo, { signedIn: false, personId: null });
      const publicOnly = { ...c, docs: c.docs.filter((d) => d.modes.includes('public')), personal: [] };
      setResult(await runEval(createEngine(settings[0]?.engine), publicOnly, EVAL_SET));
      // W5E5 (F37): career mode, on the fixed synthetic evaluation persona over the live catalogues (staff corpus for the fallback)
      const [job_roles, career_paths, role_competencies, competencies, skills, qual_standards, programmes, courses, sources, opportunities, engine_settings] = await Promise.all([
        repo.list('job_roles'), repo.list('career_paths'), repo.list('role_competencies'), repo.list('competencies'), repo.list('skills'), repo.list('qual_standards'), repo.list('programmes'),
        repo.list('courses'), repo.list('sources'), repo.list('opportunities', { filter: { status: 'open' } }).catch(() => []), repo.list('engine_settings'),
      ]);
      const ctx = evalCareerCtx({ job_roles, career_paths, role_competencies, competencies, skills, qual_standards, programmes, courses, sources, opportunities, engine_settings } as never, todayIso());
      const staffCorpus = await buildCorpus(repo, { signedIn: true, personId: s.identity.personId });
      const inner = settings[0]?.engine === 'model-gateway' ? new ModelGatewayEngine(new RetrievalEngine(), null) : new RetrievalEngine();
      setCareer(await runCareerEval(new GuardedEngine(new CareerEngine(ctx, inner)), { ...staffCorpus, personal: [] }, CAREER_EVAL_SET));
    } finally {
      setBusy(false);
    }
  };
  const history = (runs.data ?? []).map((r) => ({ x: r.release, cite: (r.cited_correct * 100) / Math.max(1, r.in_scope_total), ref: (r.refusal_correct * 100) / Math.max(1, r.refusal_total) }));
  const gatePass = !!result && result.pass && (!career || career.pass);
  const allDetails = [...(result?.details ?? []), ...(career?.details ?? [])];
  const questionOf = (id: string) => EVAL_SET.find((c) => c.id === id)?.q ?? CAREER_EVAL_SET.find((c) => c.id === id)?.q ?? '';
  return (
    <div className="space-y-4">
      <Callout tone="info" title={t('m13.admin.evalTitle')}>{t('m13.admin.evalIntro', { floor: f.pct(CITATION_FLOOR * 100, 0), n: f.num(EVAL_SET.length) })}</Callout>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={start} disabled={busy} data-testid="m13-eval-run">
          {busy ? t('common.working') : t('m13.admin.runEval')}
        </button>
        {result && canEdit && (
          <button
            className="btn-outline"
            onClick={() =>
              run(
                () =>
                  repo.insert('eval_runs', {
                    run_at: new Date().toISOString(), release: `r${todayIso()}`, lang: 'both', in_scope_total: result.in_scope_total + (career?.in_scope_total ?? 0), cited_correct: result.cited_correct + (career?.cited_correct ?? 0),
                    refusal_total: result.refusal_total + (career?.refusal_total ?? 0), refusal_correct: result.refusal_correct + (career?.refusal_correct ?? 0),
                    security_total: result.security_total + (career?.security_total ?? 0), security_correct: result.security_correct + (career?.security_correct ?? 0), pass: gatePass,
                    notes: `${gatePass ? 'Release gate passed' : 'Release gate failed'}${career ? ` · career mode ${Math.round(career.citationRate * 1000) / 10}% cited, security ${Math.round(career.securityRate * 100)}%` : ''}`,
                    details: allDetails, engine: 'retrieval-v1+career-v1', run_by: s.identity.personId,
                  }),
                { success: t('m13.admin.evalSaved') },
              )
            }
            data-testid="m13-eval-save"
          >
            {t('m13.admin.saveRun')}
          </button>
        )}
      </div>
      {result && (
        <div className="space-y-3" data-testid="m13-eval-result">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label={t('m13.admin.citeRate')} value={f.pct(result.citationRate * 100)} tone={result.citationRate >= CITATION_FLOOR ? 'ok' : 'bad'} sub={t('m13.admin.floorSub', { floor: f.pct(CITATION_FLOOR * 100, 0) })} />
            <Metric label={t('m13.admin.securityRate')} value={f.pct(result.securityRate * 100)} tone={result.securityRate === 1 ? 'ok' : 'bad'} sub={t('m13.admin.securitySub')} />
            <Metric label={t('m13.admin.refusalRate')} value={f.pct(result.refusalRate * 100)} />
            <Metric label={t('m13.admin.gate')} value={gatePass ? t('m13.admin.pass') : t('m13.admin.fail')} tone={gatePass ? 'ok' : 'bad'} />
          </div>
          {career && (
            <div className="space-y-2" data-testid="m13-eval-career">
              <div className="caps">{t('m13.career.admin.evalTitle', { n: f.num(CAREER_EVAL_SET.length) })}</div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label={t('m13.admin.citeRate')} value={f.pct(career.citationRate * 100)} tone={career.citationRate >= CITATION_FLOOR ? 'ok' : 'bad'} sub={t('m13.admin.floorSub', { floor: f.pct(CITATION_FLOOR * 100, 0) })} />
                <Metric label={t('m13.admin.securityRate')} value={f.pct(career.securityRate * 100)} tone={career.securityRate === 1 ? 'ok' : 'bad'} sub={t('m13.admin.securitySub')} />
                <Metric label={t('m13.admin.refusalRate')} value={f.pct(career.refusalRate * 100)} />
                <Metric label={t('m13.career.admin.persona')} value={t('m13.career.admin.personaValue')} sub={t('m13.career.admin.personaSub')} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className={only === 'all' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setOnly('all')}>{t('common.all')}</button>
            <button className={only === 'fail' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setOnly('fail')}>{t('m13.admin.failuresOnly')}</button>
          </div>
          <DataTable
            rows={allDetails.filter((d) => only === 'all' || !d.pass)}
            rowKey={(r) => r.id}
            csvName="dalil-eval"
            dense
            columns={[
              { key: 'id', header: t('m13.admin.case'), value: (r) => r.id, render: (r) => <code className="ltr text-[12px]">{r.id}</code> },
              { key: 'q', header: t('m13.admin.question'), value: (r) => questionOf(r.id) },
              { key: 'kind', header: t('m13.admin.kind'), value: (r) => (r.security ? 'security' : r.kind), render: (r) => <StatusPill tone={r.security ? 'reserved' : 'neutral'}>{r.security ? t('m13.admin.redTeam') : t(`m13.admin.${r.kind}`)}</StatusPill> },
              { key: 'got', header: t('m13.admin.got'), value: (r) => r.got },
              { key: 'pass', header: t('m13.admin.result'), value: (r) => (r.pass ? 'pass' : 'fail'), render: (r) => <StatusPill status={r.pass ? 'pass' : 'fail'} /> },
            ]}
          />
        </div>
      )}
      <Card title={t('m13.admin.history')}>
        <Async state={runs}>
          {(rows) => (
            <div className="space-y-3">
              <LineChart title={t('m13.admin.history')} unit="%" yMin={80} yMax={100} series={[{ name: t('m13.admin.citeRate'), points: history.map((h) => ({ x: h.x, y: Math.round(h.cite * 10) / 10 })) }, { name: t('m13.admin.refusalRate'), points: history.map((h) => ({ x: h.x, y: Math.round(h.ref * 10) / 10 })), tone: 'leaf' }]} />
              <ul className="space-y-1 text-[12.5px]" data-testid="m13-eval-history">
                {[...rows].reverse().map((r: EvalRunsRow) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <StatusPill status={r.pass ? 'pass' : 'fail'} />
                    <span className="font-semibold">{r.release}</span>
                    <span className="text-ink-3">{f.dateTime(r.run_at)}</span>
                    <span className="text-ink-2">{r.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Async>
      </Card>
    </div>
  );
}

// ───────────── Logs
function LogsTab() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const data = useQuery(['advisor_sessions', 'advisor_turns'], async () => {
    const [sessions, turns] = await Promise.all([repo.list('advisor_sessions', { order: [['started_at', 'desc']] }), repo.list('advisor_turns', { order: [['ts', 'asc']] })]);
    return { sessions, turns };
  });
  const [flt, setFlt] = useFilters({ mode: '', refused: '' });
  const [open, setOpen] = useState<AdvisorSessionsRow | null>(null);
  const today = todayIso();
  const refusedSessions = useMemo(() => new Set((data.data?.turns ?? []).filter((x) => x.refused).map((x) => x.session_id)), [data.data]);
  const modeOf = (x: AdvisorSessionsRow) => (x.submode === 'career' ? 'career' : x.mode); // W5E5 (F37): career sessions keep mode staff + submode career
  const rows = (data.data?.sessions ?? []).filter((x) => (!flt.mode || modeOf(x) === flt.mode) && (!flt.refused || refusedSessions.has(x.id) === (flt.refused === 'yes')));
  return (
    <div className="space-y-4">
      <Callout tone="info">{t('m13.admin.logsIntro')}</Callout>
      <FilterBar value={flt} onChange={setFlt} fields={[{ key: 'mode', label: t('m13.ask.mode'), options: ['public', 'applicant', 'staff', 'partner', 'career'].map((m) => ({ value: m, label: t(`m13.modes.${m}`) })) }, { key: 'refused', label: t('m13.admin.refusedFilter'), options: [{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }] }]} />
      <Async state={data}>
        {() =>
          rows.length === 0 ? (
            <EmptyState title={t('m13.admin.noLogs')} />
          ) : (
            <DataTable
              rows={rows}
              rowKey={(r) => r.id}
              csvName="dalil-sessions"
              onRowClick={setOpen}
              columns={[
                { key: 'started', header: t('m13.admin.started'), value: (r) => r.started_at, sortable: true, render: (r) => f.dateTime(r.started_at) },
                { key: 'mode', header: t('m13.ask.mode'), value: (r) => modeOf(r), render: (r) => t(`m13.modes.${modeOf(r)}`) },
                { key: 'who', header: t('m13.admin.who'), value: (r) => (r.person_id ? t('m13.admin.signedIn') : t('m13.admin.anonymous')) },
                { key: 'page', header: t('m13.admin.page'), value: (r) => r.page_context ?? '', render: (r) => <code className="ltr text-[12px]">{r.page_context ?? '—'}</code> },
                { key: 'turns', header: t('m13.admin.turns'), value: (r) => r.turns, align: 'end' },
                { key: 'refused', header: t('m13.admin.refusedFilter'), value: (r) => (refusedSessions.has(r.id) ? 'yes' : ''), render: (r) => (refusedSessions.has(r.id) ? <StatusPill tone="sim">{t('m13.ask.outOfScope')}</StatusPill> : null) },
                { key: 'retention', header: t('m13.admin.retentionUntil'), value: (r) => r.retention_until, render: (r) => (r.retention_until < today ? <StatusPill tone="sim">{t('m13.admin.expired')}</StatusPill> : f.date(r.retention_until)) },
              ]}
            />
          )
        }
      </Async>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={t('m13.admin.conversation')}>
        {open && (
          <ol className="space-y-3" data-testid="m13-log-turns">
            {(data.data?.turns ?? []).filter((x) => x.session_id === open.id).map((x) => (
              <li key={x.id} className={`rounded-card border p-3 text-[13px] ${x.speaker === 'user' ? 'border-accent/40 bg-accent-soft' : 'border-line'}`}>
                <div className="caps mb-1">{x.speaker === 'user' ? t('m13.admin.user') : t('m13.ask.dalil')} · {f.dateTime(x.ts)}</div>
                <div className={x.redacted ? 'italic text-ink-3' : ''}>{x.redacted ? t('m13.admin.redacted') : x.text}</div>
                {x.refused && <div className="mt-1"><StatusPill tone="sim">{t(`m13.cat.${x.refusal_category ?? 'other'}`)}</StatusPill></div>}
                {Array.isArray(x.citations) && x.citations.length > 0 && <div className="mt-1 text-[12px] text-ink-3">{(x.citations as { label: string }[]).map((c) => c.label).join(' · ')}</div>}
              </li>
            ))}
          </ol>
        )}
      </Drawer>
    </div>
  );
}

// ───────────── Hand-offs
function HandoffsTab() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery('advisor_sessions', () => repo.list('advisor_sessions', { filter: { handoff_status: ['requested', 'picked_up', 'closed'] }, order: [['last_turn_at', 'desc']] }));
  return (
    <Async state={q} empty={<EmptyState title={t('m13.admin.noHandoffs')} />}>
      {(rows) => (
        <ul className="space-y-3" data-testid="m13-handoffs">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">{t(`m13.handoff.${r.handoff}`)}</div>
                <div className="text-[12.5px] text-ink-2">{r.handoff_note ?? '—'}</div>
                <div className="text-[12px] text-ink-3">
                  {f.dateTime(r.last_turn_at ?? r.started_at)} · {r.handoff_consent ? t('m13.admin.shared') : t('m13.admin.notShared')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={r.handoff_status === 'requested' ? 'open' : r.handoff_status === 'picked_up' ? 'in_progress' : 'closed'}>{t(`m13.admin.hs.${r.handoff_status}`)}</StatusPill>
                {r.handoff_status === 'requested' && <button className="btn-outline btn-sm" onClick={() => run(() => repo.rpc.resolveDalilHandoff(r.id, 'picked_up'))}>{t('m13.admin.pickUp')}</button>}
                {r.handoff_status !== 'closed' && <button className="btn-ghost btn-sm" onClick={() => run(() => repo.rpc.resolveDalilHandoff(r.id, 'closed'))}>{t('m13.admin.close')}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Async>
  );
}

// /knowledge/capture (M24 · F21): the knowledge capture studio. The session board (planned, held, transcribed), planning a
// structured interview from a template (interviewers, the KM owner, or the SME's department head; "who to capture" comes from the
// KLRA register for those who may see it), my knowledge assets and drafts, my SME profile (opt-in) and the interview templates.
// Opened from a KLRA mitigation action with ?sme=&position=&action= the plan form is pre-filled.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Async, EmptyState, Tabs, Card, Callout, Modal, SelectField, TextField, CheckboxField, WhyThis, ConfirmDialog, Icon } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useNav, usePick, useT } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { DEPARTING_BANDS, LIMITS, SME_AVAILABILITY, SME_KINDS, TEMPLATES, TEMPLATE_IDS } from './capture';
import { addDaysIso } from './klra';
import type { CaptureBoard, CaptureSessionView } from './backend/rpc';
import { AssetPill, BandPill, Chips, MultiPick, SessionPill, Sources, CAPTURE_SOURCES, useKcLabels, useKcRefs, type KcRefs } from './ui';
import { AssetEditor } from './AssetEditor';

export default function CapturePage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const refs = useKcRefs();
  const [params] = useSearchParams();
  const board = useQuery(['capture_sessions', 'knowledge_assets', 'klra_actions'], () => repo.rpc.captureBoard(), [me]);
  const mine = useQuery(['knowledge_assets', 'sme_profiles'], async () => {
    const [assets, sme] = await Promise.all([
      me ? repo.list('knowledge_assets', { order: [['updated_at', 'desc']] }).catch(() => [] as RowOf<'knowledge_assets'>[]) : Promise.resolve([] as RowOf<'knowledge_assets'>[]),
      me ? repo.list('sme_profiles', { filter: { person_id: me } }).catch(() => [] as RowOf<'sme_profiles'>[]) : Promise.resolve([] as RowOf<'sme_profiles'>[]),
    ]);
    return { assets: assets.filter((a) => a.author_id === me || a.sme_id === me), sme: sme[0] ?? null };
  }, [me]);
  const [tab, setTab] = useState(params.get('sme') ? 'sessions' : 'sessions');
  return (
    <Page title={t('m24.routes.knowledge-capture.title')} intro={t('m24.capture.intro')} wide eyebrow={<L to="/knowledge" className="link">{t('m24.kb.back')}</L>}>
      <Async state={refs}>
        {(r) => (
          <Async state={board}>
            {(b) => (
              <Tabs value={tab} onChange={setTab} tabs={[
                { id: 'sessions', label: t('m24.capture.tabSessions'), content: <Sessions b={b} refs={r} /> },
                { id: 'assets', label: t('m24.capture.tabAssets'), badge: mine.data?.assets.filter((a) => a.status === 'draft').length ? <span className="chip border-sim-line bg-sim-bg text-sim">{mine.data.assets.filter((a) => a.status === 'draft').length}</span> : undefined, content: <MyAssets data={mine.data} refs={r} /> },
                { id: 'sme', label: t('m24.capture.tabSme'), content: <SmeProfile sme={mine.data?.sme ?? null} refs={r} /> },
                { id: 'templates', label: t('m24.capture.tabTemplates'), content: <Templates /> },
              ]} />
            )}
          </Async>
        )}
      </Async>
    </Page>
  );
}

const COLUMNS = ['planned', 'held', 'transcribed', 'cancelled'] as const;

function Sessions({ b, refs }: { b: CaptureBoard; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const [params, setParams] = useSearchParams();
  const [plan, setPlan] = useState<{ sme?: string; position?: string; action?: string } | null>(null);
  useEffect(() => {
    if (params.get('sme') || params.get('position')) setPlan({ sme: params.get('sme') ?? undefined, position: params.get('position') ?? undefined, action: params.get('action') ?? undefined });
  }, [params]);
  const klra = useQuery(['klra_assessments', 'klra_actions', 'capture_sessions'], () => (s.can('knowledge', ['A', 'Scope']) ? repo.rpc.klraRegister(null) : Promise.resolve(null)), [s.identity.personId]);
  const candidates = (klra.data?.rows ?? []).filter((x) => x.band === 'high' && x.position.person_id && !x.actions.some((a) => a.kind === 'capture' && a.status !== 'cancelled') && !b.sessions.some((y) => y.sme_id === x.position.person_id && y.status !== 'cancelled')).slice(0, 6);
  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">{b.mode === 'all' ? t('m24.capture.boardAll') : t('m24.capture.boardMine')}</p>
        {b.can_plan && <button className="btn-primary btn-sm" onClick={() => setPlan({})} data-testid="m24-capture-plan"><Icon name="plus" size={14} />{t('m24.capture.plan')}</button>}
      </div>
      {candidates.length > 0 && (
        <Card title={t('m24.capture.whoTitle')} actions={<L to="/knowledge/klra" className="link text-[12.5px]">{t('m24.capture.toKlra')}</L>}>
          <p className="mb-2 text-[12.5px] text-ink-2">{t('m24.capture.whoBody')}</p>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="m24-capture-who">
            {candidates.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2">
                <span className="min-w-0"><span className="block truncate font-semibold">{pick({ h_en: x.position.holder_en, h_ar: x.position.holder_ar }, 'h')}</span><span className="block text-[12px] text-ink-2">{pick(x.position, 'title')}</span></span>
                <span className="flex items-center gap-1"><BandPill band={x.band} /><WhyThis reasons={x.reasons} />
                  <button className="btn-outline btn-sm" onClick={() => setPlan({ sme: x.position.person_id!, position: x.position_id })}>{t('m24.capture.planThis')}</button></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {b.sessions.length === 0 ? <EmptyState icon="calendar" title={t('m24.capture.noSessions')}>{t('m24.capture.noSessionsBody')}</EmptyState> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="m24-capture-board">
          {COLUMNS.map((c) => {
            const list = b.sessions.filter((x) => x.status === c);
            return (
              <section key={c} className="min-w-0 rounded-card border border-line bg-sunken/40 p-3" aria-label={t(`m24.session.${c}`)}>
                <h3 className="caps mb-2 flex items-center justify-between">{t(`m24.session.${c}`)}<span className="num">{f.num(list.length)}</span></h3>
                <ul className="space-y-2">
                  {list.map((x) => <SessionCard key={x.id} x={x} />)}
                  {!list.length && <li className="text-[12.5px] text-ink-3">—</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <p className="text-[12px] text-ink-3">{t('m24.capture.noAudio')} <Sources list={CAPTURE_SOURCES} /></p>
      {plan && <PlanModal init={plan} refs={refs} candidates={klra.data?.rows ?? []} onClose={() => { setPlan(null); if (params.get('sme') || params.get('position')) setParams({}, { replace: true }); }} />}
    </div>
  );
}

function SessionCard({ x }: { x: CaptureSessionView }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <li className="card p-3" data-testid="m24-session-card">
      <L to={`/knowledge/capture/${x.id}`} className="link block font-semibold" dir={x.lang === 'ar' ? 'rtl' : undefined}>{x.title}</L>
      <div className="mt-1 text-[12px] text-ink-2">{t('m24.capture.smeWith', { sme: pick({ n_en: x.sme_name, n_ar: x.sme_name_ar }, 'n'), iv: pick({ n_en: x.interviewer_name, n_ar: x.interviewer_name_ar }, 'n') })}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
        <span>{t(`m24.template.${x.template}.name`)}</span>·<span>{f.date(x.held_on ?? x.planned_on)}</span>
        {x.transcript_words > 0 && <>·<span>{t('m24.capture.words', { n: f.num(x.transcript_words) })}</span></>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5"><SessionPill status={x.status} />{x.asset_status && <AssetPill status={x.asset_status} />}{x.action_id && <span className="chip border-info-line bg-info-bg text-info">{t('m24.capture.fromKlra')}</span>}</div>
    </li>
  );
}

function PlanModal({ init, refs, candidates, onClose }: { init: { sme?: string; position?: string; action?: string }; refs: KcRefs; candidates: { position: { person_id: string | null; holder_en: string; holder_ar: string; title_en: string; title_ar: string; spof_skill_ids: string[] }; band: string }[]; onClose: () => void }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const nav = useNav();
  const s = useSession();
  const lab = useKcLabels(refs);
  const people = useQuery(['people', 'sme_profiles'], async () => {
    const [ppl, smes] = await Promise.all([repo.list('people', { filter: { status: 'active' } }).catch(() => [] as RowOf<'people'>[]), repo.list('sme_profiles').catch(() => [] as RowOf<'sme_profiles'>[])]);
    return { ppl: ppl.filter((p) => (p.kind === 'staff' || p.kind === 'contractor') && p.id !== s.identity.personId), smes };
  }, [s.identity.personId]);
  const today = todayIso();
  const cand = candidates.find((c) => c.position.person_id === init.sme);
  const [sme, setSme] = useState(init.sme ?? '');
  const [template, setTemplate] = useState<string>('critical_decisions');
  const [date, setDate] = useState(addDaysIso(today, 14));
  const [title, setTitle] = useState('');
  const [skills, setSkills] = useState<string[]>((cand?.position.spof_skill_ids ?? []).filter((id) => refs.safeSkills.some((x) => x.id === id)).slice(0, LIMITS.SKILLS));
  const [stds, setStds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of candidates.filter((c) => c.position.person_id)) m.set(c.position.person_id!, `${pick({ h_en: c.position.holder_en, h_ar: c.position.holder_ar }, 'h')} · ${t(`m24.band.${c.band}`)}`);
    for (const x of people.data?.smes ?? []) if (!m.has(x.person_id)) m.set(x.person_id, `${pick({ n_en: x.person_name, n_ar: x.person_name_ar }, 'n')} · ${t('m24.capture.smeOptin')}`);
    for (const p of people.data?.ppl ?? []) if (!m.has(p.id)) m.set(p.id, pick({ n_en: p.display_name, n_ar: p.display_name_ar || p.display_name }, 'n'));
    if (init.sme && !m.has(init.sme)) m.set(init.sme, init.sme);
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [candidates, people.data, pick, t, init.sme]);
  return (
    <Modal open onClose={() => !busy && onClose()} size="lg" title={t('m24.capture.planTitle')}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={busy || !sme || title.trim().length < 5} data-testid="m24-plan-save" onClick={async () => {
          setBusy(true);
          try {
            const r = await run(() => repo.rpc.planCapture({ sme_id: sme, template, planned_on: date, title: title.trim(), skill_ids: skills, standard_ids: stds, position_id: init.position ?? null, action_id: init.action ?? null }));
            if (r.ok && r.data) { onClose(); nav(`/knowledge/capture/${r.data.id}`); }
          } finally { setBusy(false); }
        }}>{busy ? t('common.working') : t('m24.capture.planSave')}</button>
      </>}>
      <div className="space-y-3">
        {init.action && <Callout>{t('m24.capture.fromAction')}</Callout>}
        <SelectField name="sme" label={t('m24.capture.sme')} required options={options} value={sme} onChange={setSme} placeholder={t('m24.common.choose')} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField name="template" label={t('m24.capture.template')} options={TEMPLATE_IDS.map((x) => ({ value: x, label: t(`m24.template.${x}.name`) }))} value={template} onChange={setTemplate} />
          <label className="block"><span className="text-[13px] font-semibold">{t('m24.capture.date')}</span><input type="date" className="input mt-1" min={today} max={addDaysIso(today, LIMITS.PLAN_DAYS)} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <p className="text-[12.5px] text-ink-2">{t(`m24.template.${template}.purpose`)}</p>
        <TextField name="title" label={t('m24.capture.title')} required value={title} onChange={setTitle} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MultiPick label={t('m24.asset.skills')} options={refs.safeSkills.map((x) => ({ id: x.id, label: pick(x, 'name') }))} value={skills} onChange={setSkills} max={LIMITS.SKILLS} />
          <MultiPick label={t('m24.asset.standards')} options={refs.standards.map((q) => ({ id: q.id, label: lab.standard(q.id) }))} value={stds} onChange={setStds} max={LIMITS.STANDARDS} />
        </div>
        <p className="text-[12px] text-ink-3">{t('m24.capture.interviewerYou')}</p>
      </div>
    </Modal>
  );
}

function MyAssets({ data, refs }: { data: { assets: RowOf<'knowledge_assets'>[]; sme: RowOf<'sme_profiles'> | null } | undefined; refs: KcRefs }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const nav = useNav();
  const [write, setWrite] = useState(false);
  const canWrite = !!data?.sme || s.can('knowledge', ['W', 'A']);
  if (!data) return null;
  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-2">{t('m24.capture.assetsIntro')}</p>
        {canWrite && <button className="btn-outline btn-sm" onClick={() => setWrite((x) => !x)} data-testid="m24-capture-write">{write ? t('common.cancel') : t('m24.capture.writeDirect')}</button>}
      </div>
      {write && <Card title={t('m24.capture.writeDirect')}><AssetEditor seed={{}} refs={refs} source="" onDone={(id, st) => { setWrite(false); if (st === 'review') nav('/knowledge/capture'); void id; }} /></Card>}
      {data.assets.length === 0 ? <EmptyState icon="book" title={t('m24.capture.noAssets')}>{canWrite ? t('m24.capture.noAssetsBody') : t('m24.capture.becomeSme')}</EmptyState> : (
        <ul className="space-y-2" data-testid="m24-capture-assets">
          {data.assets.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                {a.status === 'published' ? <L to={`/knowledge/assets/${a.id}`} className="link font-semibold">{pick(a, 'title')}</L> : a.source_session_id ? <L to={`/knowledge/capture/${a.source_session_id}`} className="link font-semibold">{pick(a, 'title')}</L> : <span className="font-semibold">{pick(a, 'title')}</span>}
                <span className="block text-[12px] text-ink-2">{t('m24.capture.updated', { date: f.date(a.updated_at), v: f.num(a.version) })}</span>
              </span>
              <span className="flex items-center gap-2"><AssetPill status={a.status} /><Chips items={(a.skill_ids ?? []).slice(0, 2).map((id) => pick(refs.skills.find((k) => k.id === id), 'name'))} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SmeProfile({ sme, refs }: { sme: RowOf<'sme_profiles'> | null; refs: KcRefs }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [kind, setKind] = useState<string>(sme?.kind ?? 'staff');
  const [avail, setAvail] = useState<string>(sme?.availability ?? 'available');
  const [band, setBand] = useState<string>(sme?.departing_band ?? 'unspecified');
  const [skills, setSkills] = useState<string[]>(sme?.skill_ids ?? []);
  const [listed, setListed] = useState(sme?.listed ?? true);
  const [headline, setHeadline] = useState(sme?.headline ?? '');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (sme) { setKind(sme.kind); setAvail(sme.availability); setBand(sme.departing_band); setSkills(sme.skill_ids ?? []); setListed(sme.listed); setHeadline(sme.headline ?? ''); } }, [sme?.id, sme?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card title={t('m24.sme.title')} actions={sme ? <span className={`chip ${sme.listed ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-2'}`}>{t(sme.listed ? 'm24.sme.listed' : 'm24.sme.unlisted')}</span> : <span className="chip border-line bg-sunken text-ink-2">{t('m24.sme.none')}</span>}>
        <div className="space-y-3" data-testid="m24-sme-form">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField name="kind" label={t('m24.sme.kind')} options={SME_KINDS.map((x) => ({ value: x, label: t(`m24.smeKind.${x}`) }))} value={kind} onChange={setKind} />
            <SelectField name="availability" label={t('m24.sme.availability')} options={SME_AVAILABILITY.map((x) => ({ value: x, label: t(`m24.availability.${x}`) }))} value={avail} onChange={setAvail} />
            <SelectField name="band" label={t('m24.sme.window')} options={DEPARTING_BANDS.map((x) => ({ value: x, label: t(`m24.windowOpt.${x}`) }))} value={band} onChange={setBand} />
          </div>
          <MultiPick label={t('m24.sme.skills')} options={refs.safeSkills.map((x) => ({ id: x.id, label: pick(x, 'name') }))} value={skills} onChange={setSkills} max={LIMITS.SKILLS} />
          <TextField name="headline" label={t('m24.sme.headline')} value={headline} onChange={setHeadline} hint={t('m24.sme.headlineHint')} />
          <CheckboxField label={t('m24.sme.listMe')} checked={listed} onChange={setListed} hint={t('m24.sme.listHint')} />
          <button className="btn-primary btn-sm" disabled={!skills.length || headline.length > LIMITS.HEADLINE_MAX} onClick={() => setConfirm(true)} data-testid="m24-sme-save">{t('m24.sme.save')}</button>
        </div>
      </Card>
      <Callout title={t('m24.sme.privacyTitle')}>{t('m24.sme.privacyBody')}</Callout>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m24.sme.save')} consequence={listed ? t('m24.sme.confirmListed') : t('m24.sme.confirmUnlisted')}
        onConfirm={async () => { await run(() => repo.rpc.setSmeProfile({ kind, skill_ids: skills, availability: avail, departing_band: band, listed, headline: headline.trim() })); }} />
    </div>
  );
}

function Templates() {
  const t = useT();
  const pick = usePick();
  return (
    <div className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3" data-testid="m24-templates">
      {TEMPLATE_IDS.map((id) => (
        <Card key={id} title={t(`m24.template.${id}.name`)}>
          <p className="mb-2 text-[12.5px] text-ink-2">{t(`m24.template.${id}.purpose`)}</p>
          <ol className="list-decimal space-y-1 ps-5 text-[13px]">{TEMPLATES[id].prompts.map((p, i) => <li key={i}>{pick({ x_en: p.en, x_ar: p.ar }, 'x')}</li>)}</ol>
        </Card>
      ))}
    </div>
  );
}

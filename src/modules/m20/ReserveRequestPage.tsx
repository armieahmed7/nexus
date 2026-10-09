// /opportunities/reserve/request (M20 · F23): managers (W on opportunities) ask the reserve for short help. A request waits for HR
// approval before any alumnus sees it; the poster sees who was matched only after HR hands the engagement over ("handed to HR"),
// then confirms the outcome. Security, cyber, safeguards and protected-area work is never requested (restricted_kind, audited).
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, Icon, ConfirmDialog, TextField, TextArea, SelectField, RadioGroup, Stepper } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { ReserveEngagementsRow, ReserveRequestsRow, SkillsRow } from '../../data/types';
import { ENGAGEMENTS, RES_LOCATIONS, RESTRICTED_SKILL_AREAS, validateRequest, type RequestInput } from './reserve';
import { Meta } from './ui';
import { EngChip, EngPill, EngTimeline, HandoffNote, ReqPill, todayIso, useRefData, useResLabels, type RefData } from './reserveUi';

const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const REQ_STEPS = ['pending_hr', 'open', 'filled'] as const;

export default function ReserveRequestPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const ref = useRefData();
  const q = useQuery(['reserve_requests', 'reserve_engagements'], async () => {
    const [reqs, engs] = await Promise.all([
      me ? repo.list('reserve_requests', { filter: { posted_by: me }, order: [['created_at', 'desc']] }) : Promise.resolve([] as ReserveRequestsRow[]),
      repo.list('reserve_engagements', { order: [['updated_at', 'desc']] }),
    ]);
    return { reqs, engs };
  }, [me]);
  return (
    <Page title={t('m20.routes.reserve-request.title')} eyebrow={t('m20.res.hub.eyebrow')} intro={t('m20.res.req.intro')} wide
      actions={<L to="/opportunities/reserve" className="btn-outline btn-sm"><Icon name="back" size={14} className="rtl:-scale-x-100" />{t('m20.res.me.back')}</L>}>
      <Async state={ref} isEmpty={() => false}>
        {(d) => (
          <div className="space-y-8">
            <RequestForm refd={d} />
            <Section title={t('m20.res.req.mine')} description={t('m20.res.req.mineSub')}>
              <Async state={q} isEmpty={(x) => x.reqs.length === 0} empty={<EmptyState icon="briefcase" title={t('m20.res.req.none')} />}>
                {(x) => <MyRequests reqs={x.reqs} engs={x.engs} refd={d} />}
              </Async>
            </Section>
          </div>
        )}
      </Async>
    </Page>
  );
}

function RequestForm({ refd }: { refd: RefData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [params] = useSearchParams();
  const selectable = refd.skills.filter((x) => !RESTRICTED_SKILL_AREAS.includes(x.area));
  const preset = (params.get('skill') ?? '').split(',').filter((id) => selectable.some((x) => x.id === id)).slice(0, 6);
  const [v, setV] = useState({ engagement: 'capture_interview', title_en: '', title_ar: '', summary_en: '', summary_ar: '', hours_total: '12', seats: '1', location_type: 'office', start_on: addDays(14), end_on: addDays(60) });
  const [skills, setSkills] = useState<string[]>(preset);
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const input: RequestInput = { ...v, hours_total: Number(v.hours_total), seats: Number(v.seats), skills_needed: skills };
  const problem = validateRequest(input, refd.skills, todayIso());
  const fld = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (x: string) => setV((c) => ({ ...c, [k]: x })) });
  return (
    <form className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={(e) => e.preventDefault()} data-testid="m20-res-request-form">
      <div className="space-y-6">
        <Card title={t('m20.res.req.what')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label={t('m20.res.req.engagement')} required options={ENGAGEMENTS.map((k) => ({ value: k, label: t(`m20.res.eng.${k}`) }))} {...fld('engagement')} />
            <RadioGroup label={t('m20.res.req.location')} name="location_type" value={v.location_type} onChange={(x) => setV((c) => ({ ...c, location_type: x }))} options={RES_LOCATIONS.map((k) => ({ value: k, label: t(`m20.res.loc.${k}`) }))} />
            <TextField label={t('m20.post.titleEn')} required {...fld('title_en')} />
            <TextField label={t('m20.post.titleAr')} required {...fld('title_ar')} />
            <TextArea label={t('m20.post.summaryEn')} required hint={t('m20.res.req.summaryHint')} {...fld('summary_en')} />
            <TextArea label={t('m20.post.summaryAr')} required hint={t('m20.res.req.summaryHint')} {...fld('summary_ar')} />
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3"><Icon name="lock" size={12} className="me-1 inline" />{t('m20.res.req.restricted')}</p>
        </Card>
        <Card title={t('m20.res.req.skills')}>
          <SkillPick skills={selectable} value={skills} onChange={setSkills} />
        </Card>
        <Card title={t('m20.res.req.when')}>
          <div className="grid gap-3 sm:grid-cols-4">
            <TextField type="date" label={t('m20.post.start')} required {...fld('start_on')} />
            <TextField type="date" label={t('m20.post.end')} required {...fld('end_on')} />
            <TextField type="number" label={t('m20.res.req.hours')} required {...fld('hours_total')} />
            <TextField type="number" label={t('m20.res.req.seats')} required {...fld('seats')} />
          </div>
        </Card>
      </div>
      <aside className="space-y-4">
        <Card title={t('m20.post.preview')}>
          <div className="text-[13px] text-ink-2">
            <div className="mb-1"><EngChip kind={v.engagement} /></div>
            <div className="font-semibold text-ink">{v.title_en || t('m20.post.untitled')}</div>
            <div dir="rtl" className="font-arabic">{v.title_ar}</div>
            <div className="mt-2">{t(`m20.res.loc.${v.location_type}`)} · {t('m20.res.hoursTotal', { n: f.num(Number(v.hours_total) || 0) })}</div>
            <div>{f.date(v.start_on)} – {f.date(v.end_on)}</div>
            {skills.length > 0 && <ul className="mt-2 flex flex-wrap gap-1">{skills.map((id) => { const sk = refd.skills.find((x) => x.id === id); return <li key={id} className="chip border-line bg-sunken text-ink-2">{sk ? pick(sk, 'name') : id}</li>; })}</ul>}
          </div>
          {touched && problem && <p className="mt-3 text-[12.5px] text-bad" role="alert" data-testid="m20-res-request-problem">{problem.message}</p>}
          <button type="button" className="btn-primary mt-4 w-full" onClick={() => { setTouched(true); if (!problem) setConfirm(true); }} data-testid="m20-res-request-send">{t('m20.res.req.send')}</button>
        </Card>
        <Callout title={t('m20.res.req.flowTitle')}>{t('m20.res.req.flowBody')}</Callout>
      </aside>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m20.res.req.confirmTitle')} consequence={t('m20.res.req.confirmBody')}
        actingAs={s.roles.includes('training_manager') ? t('m20.post.asTm') : t('m20.post.asManager')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.requestReserve(input));
          if (r.ok) { setV((c) => ({ ...c, title_en: '', title_ar: '', summary_en: '', summary_ar: '' })); setSkills([]); setTouched(false); }
        }} />
    </form>
  );
}

function SkillPick({ skills, value, onChange }: { skills: SkillsRow[]; value: string[]; onChange: (v: string[]) => void }) {
  const t = useT();
  const pick = usePick();
  const [term, setTerm] = useState('');
  const shown = useMemo(() => { const q = term.trim().toLowerCase(); return skills.filter((s) => !q || `${s.name_en} ${s.name_ar} ${s.code}`.toLowerCase().includes(q)); }, [skills, term]);
  return (
    <fieldset data-testid="m20-res-pick">
      <legend className="text-[13px] font-semibold">{t('m20.res.req.skillsLegend')} <span className="font-normal text-ink-3">({value.length}/6)</span></legend>
      <p className="mb-1 text-[12px] text-ink-3">{t('m20.res.req.skillsHint')}</p>
      {value.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{value.map((id) => { const s = skills.find((x) => x.id === id); return <button type="button" key={id} className="chip border-accent/30 bg-accent-soft text-eyebrow" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={t('m20.post.remove', { s: s ? pick(s, 'name') : id })}>{s ? pick(s, 'name') : id} <Icon name="close" size={10} /></button>; })}</div>}
      <input className="input" value={term} placeholder={t('common.search')} onChange={(e) => setTerm(e.target.value)} aria-label={t('m20.post.searchSkills')} />
      <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto rounded-btn border border-line p-2">
        {shown.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-[13px] hover:bg-sunken">
            <input type="checkbox" className="mt-0.5" checked={value.includes(s.id)} disabled={!value.includes(s.id) && value.length >= 6} onChange={(e) => onChange(e.target.checked ? [...value, s.id] : value.filter((x) => x !== s.id))} />
            <span><span className="num me-1 text-ink-3">{s.code}</span>{pick(s, 'name')}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MyRequests({ reqs, engs, refd }: { reqs: ReserveRequestsRow[]; engs: ReserveEngagementsRow[]; refd: RefData }) {
  const t = useT();
  const lab = useResLabels(refd);
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const [close, setClose] = useState<string | null>(null);
  const [done, setDone] = useState<ReserveEngagementsRow | null>(null);
  const stepOf = (st: string) => (st === 'pending_hr' ? 0 : st === 'open' ? 1 : st === 'filled' ? 2 : st === 'closed' ? 3 : 0);
  return (
    <div className="space-y-4" data-testid="m20-res-my-requests">
      {reqs.map((r) => {
        const mine = engs.filter((e) => e.request_id === r.id);
        return (
          <Card key={r.id} as="article">
            <div className="flex flex-wrap items-start justify-between gap-2" data-testid="m20-res-my-request">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap gap-1.5"><EngChip kind={r.engagement} /><ReqPill status={r.status} /></div>
                <div className="text-[15px] font-semibold">{pick(r, 'title')}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <Meta icon="calendar">{f.date(r.start_on)} – {f.date(r.end_on)}</Meta>
                  <Meta icon="reset">{t('m20.res.hoursTotal', { n: f.num(r.hours_total) })}</Meta>
                  <Meta icon="users">{t('m20.res.req.places', { taken: f.num(r.seats_taken), seats: f.num(r.seats) })}</Meta>
                  <Meta icon="sparkle">{t('m20.res.req.interest', { n: f.num(r.interest_count) })}</Meta>
                </div>
              </div>
              {['pending_hr', 'open', 'filled'].includes(r.status) && <button type="button" className="btn-ghost btn-sm" onClick={() => setClose(r.id)}>{t('m20.res.req.close')}</button>}
            </div>
            {r.status !== 'declined' ? <div className="mt-3"><Stepper steps={[...REQ_STEPS.map((x) => ({ id: x, label: t(`m20.res.reqStep.${x}`) })), { id: 'closed', label: t('m20.res.reqStep.closed') }]} current={stepOf(r.status)} /></div>
              : <p className="mt-2 rounded-btn bg-bad-bg px-3 py-2 text-[13px] text-bad">{t('m20.res.req.declined', { note: r.hr_note ?? '' })}</p>}
            {r.status === 'pending_hr' && <p className="mt-2 text-[12.5px] text-ink-3">{t('m20.res.req.awaitingHr')}</p>}
            <ul className="mt-2 flex flex-wrap gap-1.5">{r.skills_needed.map((id) => <li key={id} className="chip border-line bg-sunken text-ink-2">{lab.skill(id)}</li>)}</ul>
            {mine.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <div className="caps">{t('m20.res.req.matched')}</div>
                {mine.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-sunken/60 px-3 py-2" data-testid="m20-res-handed">
                    <div className="min-w-0 text-[13px]"><span className="font-semibold">{pick({ name_en: e.alumni_name, name_ar: e.alumni_name_ar }, 'name') || t('m20.res.anonymised')}</span> · <EngPill status={e.status} />{e.outcome_note && <span className="ms-2 text-ink-2">“{e.outcome_note}”</span>}</div>
                    {e.status === 'handed_to_hr' && <button type="button" className="btn-primary btn-sm" onClick={() => setDone(e)} data-testid="m20-res-complete">{t('m20.res.req.complete')}</button>}
                  </div>
                ))}
                <HandoffNote />
              </div>
            )}
          </Card>
        );
      })}
      <ConfirmDialog open={!!close} onClose={() => setClose(null)} title={t('m20.res.req.closeTitle')} consequence={t('m20.res.req.closeBody')} onConfirm={async () => { if (close) await run(() => repo.rpc.decideReserveRequest(close, 'close')); }} />
      <ConfirmDialog open={!!done} onClose={() => setDone(null)} title={t('m20.res.req.completeTitle')} consequence={t('m20.res.req.completeBody')} requireReason reasonLabel={t('m20.res.req.outcome')}
        onConfirm={async (reason) => { if (done) await run(() => repo.rpc.decideReserveEngagement(done.id, 'complete', reason)); }}>
        {done && <EngTimeline history={done.history} who={() => ''} />}
      </ConfirmDialog>
    </div>
  );
}

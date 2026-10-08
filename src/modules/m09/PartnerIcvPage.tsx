// M09 /partner/icv: ICV explainer, the supplier's improvement plan and certificate upload. The National In-Country Value
// Programme is run by MoIAT; ENEC uses the ICV score in tender evaluation. Plans change only through RPCs: a supplier saves or
// submits, ENEC reviews or returns with a note. Scores for the synthetic demo suppliers are SIMULATED.
import { useEffect, useState } from 'react';
import { Page, Section, Card, Callout, Async, Grid, StatTile, BarChart, ConfirmDialog, TextField, SimChip, SourceLink, KeyValue, Icon } from '../../ui';
import { useT, useFormat, useLang } from '../../i18n';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { icvCheck, icvSubmittable, type IcvLever } from '../../domain/partners';
import { MStatus, fileFingerprint, shortHash, useMyOrg, useSourceDates } from './shared';

const ICV_URL = 'https://www.enec.ae/vendors/vendor-education/icv/';
type Plan = RowOf<'icv_plans'>;
type Draft = { baseline: string; target: string; target_year: string; levers: IcvLever[]; certificate_file: string; certificate_sha256: string; certificate_valid_to: string };
const toDraft = (p: Plan | null, fallbackScore: number | null): Draft => ({
  baseline: String(p?.baseline ?? fallbackScore ?? ''),
  target: String(p?.target ?? ''),
  target_year: String(p?.target_year ?? new Date().getUTCFullYear() + 2),
  levers: ((p?.levers as IcvLever[]) ?? []).map((l) => ({ ...l })),
  certificate_file: p?.certificate_file ?? '',
  certificate_sha256: p?.certificate_sha256 ?? '',
  certificate_valid_to: p?.certificate_valid_to ?? '',
});

export default function PartnerIcvPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const dates = useSourceDates();
  const { orgId, org } = useMyOrg();
  const q = useQuery('icv_plans', async () => (await repo.list('icv_plans', { filter: { org_id: orgId ?? '' } }))[0] ?? null, [orgId]);
  return (
    <Page title={t('m09.routes.partner-icv.title')} intro={t('m09.icv.intro')}>
      <Section title={t('m09.icv.explainTitle')}>
        <Card>
          <div className="space-y-2 text-[14px]">
            <p>{t('m09.sup.icvBody1')}</p>
            <p>{t('m09.icv.explain2')}</p>
            <SourceLink href={ICV_URL} date={t('common.asOf', { date: f.date(dates.get('enec-icv') ?? '2026-10-08') })}>{t('m09.sup.srcIcv')}</SourceLink>
          </div>
        </Card>
      </Section>
      <Async state={q} isEmpty={() => false}>{(plan) => <PlanView plan={plan} orgId={orgId} score={org?.icv_score ?? null} synthetic={!!org?.synthetic} />}</Async>
    </Page>
  );
}

function PlanView({ plan, orgId, score, synthetic }: { plan: Plan | null; orgId: string | null; score: number | null; synthetic: boolean }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const { isAdmin } = useMyOrg();
  const [d, setD] = useState<Draft>(() => toDraft(plan, score));
  const [confirm, setConfirm] = useState<null | 'save' | 'submit'>(null);
  useEffect(() => setD(toDraft(plan, score)), [plan, score]);
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const asPlan = { baseline: num(d.baseline), target: num(d.target), target_year: num(d.target_year), levers: d.levers.map((l) => ({ ...l, delta: Number(l.delta) })), certificate_file: d.certificate_file || null, certificate_valid_to: d.certificate_valid_to || null };
  const chk = icvCheck(asPlan);
  const sub = icvSubmittable(asPlan);
  const locked = plan?.status === 'submitted';
  const canEdit = isAdmin && !locked;
  const setLever = (i: number, patch: Partial<IcvLever>) => setD((x) => ({ ...x, levers: x.levers.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const save = async (submit: boolean) => {
    if (!orgId) return;
    await run(() => repo.rpc.saveIcvPlan(orgId, { ...asPlan, levers: asPlan.levers.map((l) => ({ lever: l.lever.trim(), en: l.en, ar: l.ar, delta: l.delta })), certificate_sha256: d.certificate_sha256 || null }, submit), { success: submit ? t('m09.icv.submitted') : t('m09.icv.saved') });
  };

  return (
    <>
      {plan?.status === 'draft' && plan.review_note && <Callout tone="sim" title={t('m09.icv.returnedTitle')}>{plan.review_note}</Callout>}
      {plan?.status === 'reviewed' && <Callout tone="ok" title={t('m09.icv.reviewedTitle')}>{plan.review_note || t('m09.icv.reviewedBody')}</Callout>}
      {locked && <Callout tone="info" title={t('m09.icv.lockedTitle')}>{t('m09.icv.lockedBody')}</Callout>}
      {!isAdmin && <Callout tone="info" title={t('m09.onb.readOnlyTitle')}>{t('m09.icv.readOnly')}</Callout>}

      <Grid cols={4}>
        <StatTile label={t('m09.icv.score')} value={score != null ? f.num(score) : '—'} sub={synthetic ? t('m09.icv.scoreSim') : t('m09.icv.scoreSub')} sim={synthetic} />
        <StatTile label={t('m09.icv.gap')} value={Number.isFinite(chk.gap) ? f.num(chk.gap) : '—'} sub={t('m09.icv.gapSub', { y: d.target_year })} />
        <StatTile label={t('m09.icv.levers')} value={f.num(chk.leverTotal)} sub={chk.covered ? t('m09.icv.covered') : t('m09.icv.short')} tone={chk.covered ? 'ok' : 'bad'} />
        <StatTile label={t('m09.icv.cert')} value={t(`m09.icv.certState.${chk.certificate}`)} sub={d.certificate_valid_to ? t('m09.icv.certUntil', { date: f.date(d.certificate_valid_to) }) : t('m09.icv.certNone')} tone={chk.certificate === 'valid' ? 'ok' : chk.certificate === 'missing' ? undefined : 'bad'} />
      </Grid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <Card title={t('m09.icv.planTitle')} actions={plan ? <MStatus status={plan.status} /> : <MStatus status="not_started" />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextField label={t('m09.icv.baseline')} name="baseline" type="number" value={d.baseline} onChange={(v) => setD((x) => ({ ...x, baseline: v }))} disabled={!canEdit} hint={t('m09.icv.baselineHint')} />
            <TextField label={t('m09.icv.target')} name="target" type="number" value={d.target} onChange={(v) => setD((x) => ({ ...x, target: v }))} disabled={!canEdit} />
            <TextField label={t('m09.icv.year')} name="year" type="number" value={d.target_year} onChange={(v) => setD((x) => ({ ...x, target_year: v }))} disabled={!canEdit} />
          </div>
          <fieldset className="mt-4 space-y-2" data-testid="m09-icv-levers">
            <legend className="text-[13px] font-semibold">{t('m09.icv.leversTitle')}</legend>
            {d.levers.length === 0 && <p className="text-[12.5px] text-ink-3">{t('m09.icv.noLevers')}</p>}
            {d.levers.map((l, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-btn border border-line p-2 sm:grid-cols-[1fr_2fr_90px_auto] sm:items-end">
                <TextField label={t('m09.icv.leverName')} name={`lever-${i}`} value={l.lever} onChange={(v) => setLever(i, { lever: v })} disabled={!canEdit} />
                <TextField label={t('m09.icv.leverAction')} name={`lever-en-${i}`} value={(lang === 'ar' ? l.ar : l.en) ?? ''} onChange={(v) => setLever(i, { en: v, ar: v })} disabled={!canEdit} />
                <TextField label={t('m09.icv.leverPoints')} name={`lever-d-${i}`} type="number" value={String(l.delta)} onChange={(v) => setLever(i, { delta: Number(v) })} disabled={!canEdit} />
                {canEdit && <button className="btn-ghost btn-sm" onClick={() => setD((x) => ({ ...x, levers: x.levers.filter((_, j) => j !== i) }))} aria-label={t('m09.wf.f.remove')}>{t('m09.wf.f.remove')}</button>}
              </div>
            ))}
            {canEdit && <button className="btn-outline btn-sm" onClick={() => setD((x) => ({ ...x, levers: [...x.levers, { lever: '', en: '', ar: '', delta: 1 }] }))} data-testid="m09-icv-add-lever"><Icon name="plus" size={12} /> {t('m09.icv.addLever')}</button>}
          </fieldset>
          <fieldset className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-[13px] font-semibold">{t('m09.icv.certTitle')}</legend>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold">{t('m09.icv.certFile')}</span>
              <label className={`btn-outline btn-sm w-fit ${canEdit ? 'cursor-pointer' : 'pointer-events-none opacity-60'}`}>
                {d.certificate_file ? t('m09.onb.replace') : t('m09.onb.upload')}
                <input type="file" className="sr-only" disabled={!canEdit} accept=".pdf,.png,.jpg,.jpeg" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const fp = await fileFingerprint(file); setD((x) => ({ ...x, certificate_file: fp.name, certificate_sha256: fp.sha256 })); } }} data-testid="m09-icv-cert-file" />
              </label>
              <span className="text-[12px] text-ink-3"><span className="ltr">{d.certificate_file || '—'}</span>{d.certificate_sha256 ? ` · SHA-256 ${shortHash(d.certificate_sha256)}` : ''}</span>
            </div>
            <TextField label={t('m09.icv.certValid')} name="validto" type="date" value={d.certificate_valid_to} onChange={(v) => setD((x) => ({ ...x, certificate_valid_to: v }))} disabled={!canEdit} />
          </fieldset>
          {canEdit && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button className="btn-outline" disabled={!chk.valid} onClick={() => setConfirm('save')} data-testid="m09-icv-save">{t('m09.icv.saveDraft')}</button>
              <button className="btn-primary" disabled={!sub.ok} onClick={() => setConfirm('submit')} data-testid="m09-icv-submit">{t('m09.icv.submit')}</button>
              {!sub.ok && <span className="text-[12px] text-ink-3">{sub.problems.map((p) => t(`m09.icv.problem.${p}`)).join(' · ')}</span>}
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title={t('m09.icv.chartTitle')}>
            {d.levers.length ? (
              <BarChart title={t('m09.icv.chartTitle')} data={d.levers.map((l) => ({ label: l.lever || '—', value: Number(l.delta) || 0 }))} target={Number.isFinite(chk.gap) ? chk.gap : undefined} />
            ) : <p className="text-[12.5px] text-ink-3">{t('m09.icv.noLevers')}</p>}
            <p className="mt-2 text-[12px] text-ink-3">{t('m09.icv.chartNote')}</p>
          </Card>
          {plan && (
            <Card title={t('m09.icv.reviewTitle')}>
              <KeyValue items={[
                [t('m09.icv.planStatus'), <MStatus key="s" status={plan.status} />],
                [t('m09.onb.submitted'), plan.submitted_at ? f.dateTime(plan.submitted_at) : '—'],
                [t('m09.icv.reviewedAt'), plan.reviewed_at ? f.dateTime(plan.reviewed_at) : '—'],
                [t('m09.icv.reviewNote'), plan.review_note || '—'],
              ]} />
            </Card>
          )}
          {synthetic && <p className="flex items-center gap-2 text-[12px] text-ink-3"><SimChip />{t('m09.icv.simNote')}</p>}
        </div>
      </div>
      <ConfirmDialog open={confirm === 'save'} onClose={() => setConfirm(null)} title={t('m09.icv.saveDraft')} consequence={t('m09.icv.saveBody')} actingAs={t('m09.home.roleAdmin')} onConfirm={() => save(false)} />
      <ConfirmDialog open={confirm === 'submit'} onClose={() => setConfirm(null)} title={t('m09.icv.submit')} consequence={t('m09.icv.submitBody')} actingAs={t('m09.home.roleAdmin')} onConfirm={() => save(true)} />
    </>
  );
}

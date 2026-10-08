// M06 /apply/:programme: light application or expression of interest. Collects the minimum (no Emirates ID or date of birth),
// shows eligibility up front, and submits through rpc.submitApplication behind a ConfirmDialog. Never decides anything.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useRepo, useQuery } from '../../data';
import { useSession } from '../../auth/session';
import { Page, Card, Async, EmptyState, Callout, Stepper, KeyValue, ConfirmDialog, RadioGroup, SelectField, TextArea, CheckboxField, Icon, StatusPill } from '../../ui';
import { L, usePick, useT, useI18n } from '../../i18n';
import { FINDER_STAGES, NationalityBadge, SourceList, isClosed } from './shared';

export default function ApplyPage() {
  const { programme = '' } = useParams();
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const s = useSession();
  const q = useQuery('talent_programmes', () => repo.get('talent_programmes', programme), [programme]);
  const mine = useQuery('applications', () => (s.status === 'signed_in' ? repo.list('applications', { filter: { programme_id: programme } }) : Promise.resolve([])), [programme, s.status, s.persona?.persona]);

  return (
    <Async state={q} isEmpty={(d) => d === null} empty={<Page title={t('m06.routes.apply.title')}><EmptyState title={t('m06.programme.notFound')} action={<L to="/pathways" className="btn-outline btn-sm">{t('m06.programme.back')}</L>} /></Page>}>
      {(p) =>
        p && (
          <Page title={t('m06.apply.title', { name: pick(p, 'name') })} eyebrow={t('m06.routes.apply.title')} intro={t('m06.apply.intro')}>
            <Card title={pick(p, 'name')} actions={<NationalityBadge value={p.nationality} />}>
              <KeyValue items={[[t('m06.card.nationality'), t(`m06.nationality.${p.nationality}`)], [t('m06.card.education'), pick(p, 'education')], [t('m06.card.duration'), pick(p, 'duration')]]} />
              <div className="mt-2"><SourceList sources={p.sources} /></div>
            </Card>
            {p.apply_mode === 'link_out' ? (
              <Callout tone="info" title={t('m06.apply.linkOutTitle')}>
                {t('m06.apply.linkOutBody')}{' '}
                {p.link_out_url && <a href={p.link_out_url} target="_blank" rel="noopener noreferrer">{t('m06.card.applyOfficial')}</a>}
              </Callout>
            ) : p.apply_mode === 'closed' ? (
              <Callout tone="sim" title={t('m06.card.intakeClosed')}>{t('m06.apply.closedBody')}</Callout>
            ) : s.status === 'loading' ? null : s.status !== 'signed_in' ? (
              <SignInFirst />
            ) : !s.can('applications', ['Own']) ? (
              <Callout tone="sim" title={t('m06.apply.cannotTitle')}>{t('m06.apply.cannotBody')}</Callout>
            ) : (
              <Async state={mine} empty={<ApplyForm programmeId={p.id} school={p.stage === 'school'} />}>
                {(apps) => {
                  const open = apps.find((a) => !isClosed(a.stage));
                  return open ? (
                    <Callout tone="info" title={t('m06.apply.alreadyTitle')}>
                      {t('m06.apply.alreadyBody', { stage: t(`m06.appStage.${open.stage}`) })}{' '}
                      <L to="/my/applications">{t('m06.apply.track')}</L>
                    </Callout>
                  ) : (
                    <ApplyForm programmeId={p.id} school={p.stage === 'school'} />
                  );
                }}
              </Async>
            )}
          </Page>
        )
      }
    </Async>
  );
}

function SignInFirst() {
  const t = useT();
  const { path } = useI18n();
  return (
    <Card title={t('m06.apply.signInTitle')} eyebrow={t('m06.apply.signInEyebrow')}>
      <p className="text-ink-2">{t('m06.apply.signInBody')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <L to={`/sign-in?next=${encodeURIComponent(path)}`} className="btn-primary" data-testid="m06-apply-signin">
          <Icon name="user" size={15} />
          {t('m06.apply.signIn')}
        </L>
        <L to="/pathways" className="btn-outline">{t('m06.programme.back')}</L>
      </div>
    </Card>
  );
}

function ApplyForm({ programmeId, school }: { programmeId: string; school: boolean }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(school ? 'interest' : 'application');
  const [stage, setStage] = useState('');
  const [nat, setNat] = useState('');
  const [edu, setEdu] = useState('');
  const [why, setWhy] = useState('');
  const [lang, setLang] = useState('ar');
  const [consent, setConsent] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<{ id: string; stage: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (done)
    return (
      <div data-testid="m06-apply-done">
      <Card title={done.stage === 'interest' ? t('m06.apply.doneInterest') : t('m06.apply.doneTitle')}>
        <p className="text-ink-2">{t('m06.apply.doneBody')}</p>
        <div className="mt-2"><StatusPill status={done.stage}>{t(`m06.appStage.${done.stage}`)}</StatusPill></div>
        <L to="/my/applications" className="btn-primary mt-3">{t('m06.apply.track')}</L>
      </Card>
      </div>
    );

  const steps = [{ id: 'about', label: t('m06.apply.step.about') }, { id: 'motivation', label: t('m06.apply.step.motivation') }, { id: 'review', label: t('m06.apply.step.review') }];
  const next = () => {
    if (step === 0 && (!stage || !nat)) return setErr(t('m06.apply.needAbout'));
    if (step === 2 && !consent) return setErr(t('m06.apply.needConsent'));
    setErr(null);
    if (step < 2) setStep(step + 1);
    else setConfirm(true);
  };
  const answers: Record<string, string> = { stage_finder: stage, nationality: nat, education: edu, motivation: why.slice(0, 600), contact_language: lang, ...(mode === 'interest' ? { mode: 'interest' } : {}) };

  return (
    <Card title={t('m06.apply.formTitle')} eyebrow={t('m06.apply.formEyebrow')}>
      <Stepper steps={steps} current={step} />
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); next(); }} data-testid="m06-apply-form">
        {step === 0 && (
          <>
            {school && (
              <RadioGroup label={t('m06.apply.modeLabel')} name="mode" value={mode} onChange={setMode} options={[{ value: 'interest', label: t('m06.apply.modeInterest') }, { value: 'application', label: t('m06.apply.modeApplication') }]} />
            )}
            <SelectField label={t('m06.apply.stageLabel')} name="stage" value={stage} onChange={setStage} required options={FINDER_STAGES.map((x) => ({ value: x, label: t(`m06.finder.${x}`) }))} />
            <RadioGroup label={t('m06.apply.natLabel')} name="nat" value={nat} onChange={setNat} options={[{ value: 'uae', label: t('m06.apply.natUae') }, { value: 'other', label: t('m06.apply.natOther') }, { value: 'unknown', label: t('m06.apply.natSkip') }]} />
            <SelectField label={t('m06.apply.eduLabel')} name="edu" value={edu} onChange={setEdu} options={['school', 'high_school', 'diploma', 'bachelor', 'postgraduate'].map((x) => ({ value: x, label: t(`m06.edu.${x}`) }))} hint={t('m06.apply.eduHint')} />
          </>
        )}
        {step === 1 && (
          <>
            <TextArea label={t('m06.apply.whyLabel')} name="why" value={why} onChange={(v) => setWhy(v.slice(0, 600))} hint={t('m06.apply.whyHint', { n: 600 - why.length })} />
            <RadioGroup label={t('m06.apply.langLabel')} name="lang" value={lang} onChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
          </>
        )}
        {step === 2 && (
          <>
            <KeyValue
              items={[
                [t('m06.apply.modeLabel'), mode === 'interest' ? t('m06.apply.modeInterest') : t('m06.apply.modeApplication')],
                [t('m06.apply.stageLabel'), stage ? t(`m06.finder.${stage}`) : '—'],
                [t('m06.apply.natLabel'), nat ? t(`m06.apply.nat_${nat}`) : '—'],
                [t('m06.apply.eduLabel'), edu ? t(`m06.edu.${edu}`) : '—'],
                [t('m06.apply.whyLabel'), why || '—'],
              ]}
            />
            <Callout tone="info" title={t('m06.apply.minimumTitle')}>{t('m06.apply.minimumBody')}</Callout>
            <CheckboxField label={t('m06.apply.consent')} hint={t('m06.apply.consentHint')} checked={consent} onChange={setConsent} />
          </>
        )}
        {err && <p role="alert" className="text-[13px] text-bad">{err}</p>}
        <div className="flex flex-wrap gap-2">
          {step > 0 && <button type="button" className="btn-outline" onClick={() => setStep(step - 1)}>{t('common.back')}</button>}
          <button type="submit" className="btn-primary" data-testid="m06-apply-next">{step < 2 ? t('common.next') : t('m06.apply.submit')}</button>
        </div>
      </form>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m06.apply.confirmTitle')}
        consequence={t('m06.apply.confirmBody')}
        actingAs={t('m06.apply.actingAs')}
        confirmLabel={t('m06.apply.submit')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.submitApplication(programmeId, answers));
          if (r.ok && r.data) setDone(r.data);
        }}
      />
    </Card>
  );
}

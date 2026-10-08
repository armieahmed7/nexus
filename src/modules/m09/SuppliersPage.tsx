// M09 /suppliers: how to become a Barakah supplier. Localisation, quality expectations, ICV, the readiness path and the
// supplier academy, then a register-interest form routed to the supplier development mailbox. Kafa'a prepares; ENEC qualifies.
import { useState } from 'react';
import { Page, Section, Card, Callout, Async, Grid, StatTile, Stepper, SimChip, SourceLink, TextField, TextArea, CheckboxField, useForm, required, email, minLen, maxLen, Icon } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useSourceDates } from './shared';

const PATH = ['orientation', 'quality', 'safety_culture', 'icv', 'handoff', 'contractors'] as const;
const QUALITY = ['asme', 'nqa1', 'cgd', 'cfsi'] as const;
const LOCALISATION_URL = 'https://www.enec.ae/vendors/vendor-education/potential-opportunities-in-the-project/localization-opportunities/';
const ICV_URL = 'https://www.enec.ae/vendors/vendor-education/icv/';
const OVERVIEW_URL = 'https://www.enec.ae/about-us/overview/';

export default function SuppliersPage() {
  const t = useT();
  const s = useSession();
  return (
    <Page title={t('m09.routes.suppliers.title')} eyebrow={t('m09.sup.eyebrow')} intro={t('m09.sup.intro')}
      actions={
        s.status === 'signed_in' && (s.roles.includes('partner_admin') || s.roles.includes('partner_user')) ? (
          <L to="/partner/onboarding" className="btn-primary" data-testid="m09-sup-continue">{t('m09.sup.continue')}</L>
        ) : (
          <a href="#register" className="btn-primary" data-testid="m09-sup-register-jump">{t('m09.sup.registerJump')}</a>
        )
      }>
      <Callout tone="info" title={t('m09.sup.prepTitle')}>{t('m09.sup.prepBody')}</Callout>
      <Facts />
      <ReadinessPath />
      <Quality />
      <Icv />
      <Academy />
      <Register />
    </Page>
  );
}

function Facts() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const dates = useSourceDates();
  const q = useQuery(['facts', 'sources'], async () => {
    const [facts, sources] = await Promise.all([repo.list('facts', { filter: { key: 'suppliers' } }), repo.list('sources')]);
    return facts.map((x) => ({ ...x, src: sources.find((s) => s.id === x.source_id) ?? null }));
  });
  return (
    <Section title={t('m09.sup.factsTitle')}>
      <Async state={q} isEmpty={() => false}>
        {(facts) => (
          <Grid cols={3}>
            {facts.map((x) => (
              <StatTile key={x.id} label={pick(x, 'label')} value={pick(x, 'value')} sub={pick(x, 'detail')}
                source={x.src ? <SourceLink href={x.src.url} date={t('common.asOf', { date: f.date(x.as_of) })}>{x.src.label}</SourceLink> : null} />
            ))}
            <StatTile label={t('m09.sup.factAedLabel')} value={t('m09.sup.factAedValue')} sub={t('m09.sup.factAedSub')}
              source={<SourceLink href={OVERVIEW_URL} date={t('common.asOf', { date: f.date(dates.get('enec-overview') ?? '2026-10-08') })}>{t('m09.sup.srcOverview')}</SourceLink>} />
            <StatTile label={t('m09.sup.factOspsLabel')} value={t('m09.sup.factOspsValue')} sub={t('m09.sup.factOspsSub')}
              source={<SourceLink href={LOCALISATION_URL} date={t('common.asOf', { date: f.date(dates.get('enec-localisation') ?? '2026-10-08') })}>{t('m09.sup.srcLocalisation')}</SourceLink>} />
          </Grid>
        )}
      </Async>
    </Section>
  );
}

function ReadinessPath() {
  const t = useT();
  const [cur, setCur] = useState(0);
  return (
    <Section title={t('m09.sup.pathTitle')} description={t('m09.sup.pathDesc')}>
      <Card>
        <Stepper steps={PATH.map((p) => ({ id: p, label: t(`m09.sup.path.${p}.title`) }))} current={cur} />
        <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m09-sup-path">
          {PATH.map((p, i) => (
            <li key={p}>
              <button className={`card h-full w-full p-3 text-start transition hover:border-accent ${cur === i ? 'border-accent bg-accent-soft' : ''}`} aria-pressed={cur === i} onClick={() => setCur(i)}>
                <div className="caps">{t('m09.sup.stepN', { n: i + 1 })}</div>
                <div className="font-semibold">{t(`m09.sup.path.${p}.title`)}</div>
                <p className="mt-1 text-[13px] text-ink-2">{t(`m09.sup.path.${p}.body`)}</p>
                <p className="mt-2 text-[12.5px]"><span className="font-semibold">{t('m09.sup.outcome')}: </span>{t(`m09.sup.path.${p}.outcome`)}</p>
              </button>
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
}

function Quality() {
  const t = useT();
  return (
    <Section title={t('m09.sup.qualityTitle')} description={t('m09.sup.qualityDesc')}>
      <Grid cols={4}>
        {QUALITY.map((k) => (
          <Card key={k} eyebrow={t(`m09.sup.q.${k}.code`)} title={t(`m09.sup.q.${k}.title`)}>
            <p className="text-[13px] text-ink-2">{t(`m09.sup.q.${k}.body`)}</p>
          </Card>
        ))}
      </Grid>
      <p className="text-[12.5px] text-ink-3">
        {t('m09.sup.qualityFoot')} <SourceLink href={LOCALISATION_URL}>{t('m09.sup.srcLocalisation')}</SourceLink>
      </p>
    </Section>
  );
}

function Icv() {
  const t = useT();
  const f = useFormat();
  const dates = useSourceDates();
  return (
    <Section title={t('m09.sup.icvTitle')}>
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-2 text-[14px]">
            <p>{t('m09.sup.icvBody1')}</p>
            <p>{t('m09.sup.icvBody2')}</p>
            <SourceLink href={ICV_URL} date={t('common.asOf', { date: f.date(dates.get('enec-icv') ?? '2026-10-08') })}>{t('m09.sup.srcIcv')}</SourceLink>
          </div>
          <ul className="space-y-2 text-[13px]">
            {['hire', 'source', 'invest', 'train'].map((k) => (
              <li key={k} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 text-ok" />{t(`m09.sup.icvLever.${k}`)}</li>
            ))}
            <li className="text-[12px] text-ink-3">{t('m09.sup.icvLeverFoot')}</li>
          </ul>
        </div>
      </Card>
    </Section>
  );
}

function Academy() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery('courses', () => repo.list('courses', { filter: { audience: 'supplier' }, order: [['code', 'asc']] }));
  return (
    <Section title={t('m09.sup.academyTitle')} description={t('m09.sup.academyDesc')} actions={<SimChip label={t('m09.academy.concept')} />}>
      <Async state={q}>
        {(courses) => (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4" data-testid="m09-sup-courses">
            {courses.map((c) => (
              <li key={c.id} className="card p-3">
                <div className="caps num">{c.code}</div>
                <div className="font-semibold leading-snug">{pick(c, 'title')}</div>
                <p className="mt-1 text-[12.5px] text-ink-2">{pick(c, 'summary')}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-[12px]">
                  <span className="chip border-line bg-sunken text-ink-2">{t(`m09.modality.${c.modality}`)}</span>
                  {c.duration_hours != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.academy.hours', { n: f.num(c.duration_hours) })}</span>}
                  {c.pass_mark != null && <span className="chip border-line bg-sunken text-ink-2">{t('m09.academy.passMark', { n: f.num(c.pass_mark) })}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Section>
  );
}

function Register() {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const form = useForm(
    { company: '', mailbox: '', capability: '', licence: '' },
    { company: [required(), minLen(2), maxLen(120)], mailbox: [required(), email()], capability: [required(), minLen(20), maxLen(1000)], licence: [maxLen(40)] },
  );
  return (
    <Section id="register" title={t('m09.sup.registerTitle')} description={t('m09.sup.registerDesc')}>
      <Card>
        {sent ? (
          <div className="flex items-start gap-3" role="status" data-testid="m09-sup-sent">
            <Icon name="check" size={22} className="text-ok" />
            <div>
              <div className="font-semibold">{t('m09.sup.sentTitle')}</div>
              <p className="text-ink-2">{t('m09.sup.sentBody')}</p>
              <button className="btn-outline btn-sm mt-2" onClick={() => { form.reset(); setConsent(false); setSent(false); }}>{t('m09.sup.sendAnother')}</button>
            </div>
          </div>
        ) : (
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
            onSubmit={form.handleSubmit(async (v) => {
              if (!consent) return;
              const message = `Company: ${v.company}\nTrade licence: ${v.licence || '-'}\nCapability: ${v.capability}`;
              const r = await run(() => repo.insert('contact_requests', { topic: 'suppliers', route_to: 'Supplier development (role mailbox)', name: v.company, email: v.mailbox, message }), { success: t('m09.sup.sentTitle') });
              if (r.ok) setSent(true);
            })}
            data-testid="m09-sup-form"
          >
            <TextField label={t('m09.sup.f.company')} required {...form.field('company')} />
            <TextField label={t('m09.sup.f.mailbox')} type="email" required hint={t('m09.sup.f.mailboxHint')} {...form.field('mailbox')} />
            <TextField label={t('m09.sup.f.licence')} hint={t('m09.sup.f.licenceHint')} {...form.field('licence')} />
            <div className="md:col-span-2">
              <TextArea label={t('m09.sup.f.capability')} required hint={t('m09.sup.f.capabilityHint')} {...form.field('capability')} />
            </div>
            <div className="md:col-span-2">
              <CheckboxField label={t('m09.sup.f.consent')} checked={consent} onChange={setConsent} hint={t('m09.sup.f.consentHint')} />
            </div>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button type="submit" className="btn-primary" disabled={form.submitting || !consent} data-testid="m09-sup-submit">{form.submitting ? t('common.working') : t('m09.sup.f.send')}</button>
              <span className="text-[12.5px] text-ink-3">{t('m09.sup.f.already')} <L to="/sign-in">{t('m09.sup.f.signIn')}</L></span>
            </div>
          </form>
        )}
      </Card>
    </Section>
  );
}

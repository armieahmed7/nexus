// M06 /pathways/:programme: eligibility (nationality, education), duration with sources, a non-binding eligibility check,
// how the application works, related events and roles.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRepo, useQuery } from '../../data';
import { Page, Section, Grid, Card, Async, EmptyState, KeyValue, Callout, Stepper, StatusPill, Icon } from '../../ui';
import { L, usePick, useT, useLang } from '../../i18n';
import { ApplyButton, NationalityBadge, SourceList, criteriaOf, type Criterion } from './shared';

const ROLE_LINKS: Record<string, string[]> = {
  dnt: ['local-operator', 'maintenance-technician-engineer'],
  gpo: ['local-operator', 'reactor-operator', 'senior-reactor-operator'],
  gdp: ['systems-design-plant-engineer', 'corporate-professional'],
  internships: ['systems-design-plant-engineer'],
  'energy-pioneers': ['systems-design-plant-engineer', 'reactor-engineer-core-physicist'],
  'ku-msc': ['reactor-engineer-core-physicist', 'regulatory-affairs-licensing-engineer'],
  'train-for-work': ['corporate-professional'],
};

export default function PathwaysProgrammePage() {
  const { programme = '' } = useParams();
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const q = useQuery('talent_programmes', () => repo.get('talent_programmes', programme), [programme]);
  const roles = useQuery('job_roles', () => repo.list('job_roles', { filter: { id: ROLE_LINKS[programme] ?? [] } }), [programme]);

  return (
    <Async state={q} isEmpty={(d) => d === null} empty={<NotFound />}>
      {(p) =>
        p && (
          <Page
            title={pick(p, 'name')}
            eyebrow={t(`m06.stage.${p.stage}`)}
            intro={pick(p, 'facts')}
            actions={<ApplyButton p={p} />}
          >
            <Grid cols={2}>
              <Card title={t('m06.programme.eligibility')} actions={<NationalityBadge value={p.nationality} />}>
                <div data-testid="m06-programme-facts">
                  <KeyValue
                    items={[
                      [t('m06.card.nationality'), t(`m06.nationality.${p.nationality}`)],
                      [t('m06.card.education'), pick(p, 'education')],
                      [t('m06.card.duration'), pick(p, 'duration')],
                      [t('m06.card.leadsTo'), pick(p, 'outcome') || '—'],
                      [t('m06.programme.howToApply'), t(`m06.applyMode.${p.apply_mode}`)],
                    ]}
                  />
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <div className="caps mb-1">{t('common.source')}</div>
                  <SourceList sources={p.sources} />
                </div>
                {p.conflict_note && (
                  <div className="mt-3">
                    <Callout tone="sim" title={t('m06.programme.sourcesDisagree')}>
                      {lang === 'ar' && p.conflict_note_ar ? <span>{p.conflict_note_ar}</span> : <span dir="ltr" lang="en">{p.conflict_note}</span>}
                    </Callout>
                  </div>
                )}
              </Card>
              <EligibilityCheck criteria={criteriaOf(p)} />
            </Grid>

            <Section title={t('m06.programme.processTitle')} description={t('m06.programme.processHint')}>
              <Card>
                <Stepper
                  current={-1}
                  steps={['submitted', 'screening', 'assessment', 'interview', 'offer'].map((s) => ({ id: s, label: t(`m06.appStage.${s}`) }))}
                />
                <ul className="mt-3 list-disc space-y-1 ps-5 text-[13px] text-ink-2">
                  <li>{t('m06.programme.rule1')}</li>
                  <li>{t('m06.programme.rule2')}</li>
                  <li>{t('m06.programme.rule3')}</li>
                </ul>
              </Card>
            </Section>

            <Async state={roles} empty={null}>
              {(rs) => (
                <Section title={t('m06.programme.rolesTitle')} description={t('m06.programme.rolesHint')}>
                  <div className="flex flex-wrap gap-2">
                    {rs.map((r) => (
                      <L key={r.id} to={`/careers/roles/${r.id}`} className="btn-outline btn-sm">
                        <Icon name="briefcase" size={14} />
                        {pick(r, 'title')}
                      </L>
                    ))}
                  </div>
                </Section>
              )}
            </Async>
            <L to="/pathways" className="inline-flex items-center gap-1 text-[13px]">
              <Icon name="back" size={14} className="rtl:-scale-x-100" />
              {t('m06.programme.back')}
            </L>
          </Page>
        )
      }
    </Async>
  );
}

function NotFound() {
  const t = useT();
  return (
    <Page title={t('m06.routes.pathways-programme.title')}>
      <EmptyState title={t('m06.programme.notFound')} action={<L to="/pathways" className="btn-outline btn-sm">{t('m06.programme.back')}</L>} />
    </Page>
  );
}

/** Non-binding check: each published criterion as a plain-language question. It never decides anything. */
export function EligibilityCheck({ criteria }: { criteria: Criterion[] }) {
  const t = useT();
  const lang = useLang();
  const [answers, setAnswers] = useState<Record<number, 'yes' | 'no' | 'unsure'>>({});
  const questions = criteria.filter((c) => c.kind !== 'info');
  const infos = criteria.filter((c) => c.kind === 'info');
  const answered = questions.filter((_, i) => answers[i]).length;
  const anyNo = questions.some((_, i) => answers[i] === 'no');
  const anyUnsure = questions.some((_, i) => answers[i] === 'unsure');
  const text = (c: Criterion) => (lang === 'ar' ? c.ar : c.en);
  return (
    <Card title={t('m06.check.title')} eyebrow={t('m06.check.eyebrow')}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m06.check.intro')}</p>
      {questions.length === 0 ? (
        <p className="text-ink-3">{t('m06.check.noCriteria')}</p>
      ) : (
        <ol className="space-y-3" data-testid="m06-eligibility">
          {questions.map((c, i) => (
            <li key={i}>
              <fieldset>
                <legend className="text-[13.5px] font-semibold">{t(`m06.check.q.${c.kind}`, { criterion: text(c) })}</legend>
                <div className="mt-1 flex flex-wrap gap-3 text-[13px]">
                  {(['yes', 'no', 'unsure'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5">
                      <input type="radio" name={`crit-${i}`} checked={answers[i] === v} onChange={() => setAnswers((a) => ({ ...a, [i]: v }))} className="accent-[rgb(var(--accent))]" />
                      {t(`m06.check.${v}`)}
                    </label>
                  ))}
                </div>
                {answers[i] === 'no' && <p className="mt-1 text-[12.5px] text-ink-2">{t(`m06.check.explain.${c.kind}`)}</p>}
              </fieldset>
            </li>
          ))}
        </ol>
      )}
      {infos.length > 0 && (
        <div className="mt-3 text-[12.5px] text-ink-2">
          <span className="caps">{t('m06.check.alsoNote')}</span> {infos.map(text).join(' · ')}
        </div>
      )}
      {answered === questions.length && questions.length > 0 && (
        <div className="mt-3" aria-live="polite" data-testid="m06-eligibility-result">
          <Callout tone={anyNo ? 'sim' : 'ok'} title={anyNo ? t('m06.check.resultNo') : anyUnsure ? t('m06.check.resultUnsure') : t('m06.check.resultYes')}>
            {t('m06.check.notDecision')}
          </Callout>
        </div>
      )}
      <div className="mt-3">
        <StatusPill tone="neutral">{t('m06.check.nothingStored')}</StatusPill>
      </div>
    </Card>
  );
}

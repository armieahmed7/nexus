// M14 · /my/profile: the minimal profile Kafa'a keeps (no photo, no Emirates ID, no medical content), the person's
// roles and scopes, language and digit preference (the only self-editable fields) and a correction request for
// anything mirrored from a system of record.
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { roleLabel, useSession } from '../../auth/session';
import { L, useFormat, useI18n, usePick, useT } from '../../i18n';
import { Async, Callout, Card, EmptyState, KeyValue, Modal, Page, RadioGroup, StatusPill, TextArea, minLen, required, useForm } from '../../ui';
import type { PlatformRole } from '../../auth/policy';
import { accessReviewState } from '../../domain/g5rules';

export default function MyProfilePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const { lang, setLang, setPrefs } = useI18n();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const [correcting, setCorrecting] = useState(false);
  const data = useQuery(
    ['people', 'role_assignments', 'organisations', 'job_roles', 'job_families', 'data_requests'],
    async () => {
      if (!me) return null;
      const person = await repo.get('people', me);
      if (!person) return null;
      const [assignments, org, role, family, requests] = await Promise.all([
        repo.list('role_assignments', { filter: { person_id: me }, order: [['granted_at', 'desc']] }),
        person.org_id ? repo.get('organisations', person.org_id) : Promise.resolve(null),
        person.job_role_id ? repo.get('job_roles', person.job_role_id) : Promise.resolve(null),
        person.job_family_id ? repo.get('job_families', person.job_family_id) : Promise.resolve(null),
        repo.list('data_requests', { filter: { person_id: me, kind: 'correction' }, order: [['created_at', 'desc']] }),
      ]);
      return { person, assignments, org, role, family, requests };
    },
    [me],
  );

  return (
    <Page title={t('m14.routes.my-profile.title')} intro={t('m14.profile.intro')}>
      <Async state={data} isEmpty={(d) => !d} empty={<EmptyState title={t('m14.my.noProfile')}>{t('m14.profile.noRowBody')}</EmptyState>}>
        {(raw) => {
          const { person: p, assignments, org, role, family, requests } = raw!;
          const setPref = async (patch: { language?: 'en' | 'ar'; digits?: 'latn' | 'arab' }) => {
            const r = await run(() => repo.update('people', p.id, patch), { success: t('m14.profile.saved') });
            if (r.ok) {
              if (patch.digits) setPrefs({ digits: patch.digits });
              if (patch.language && patch.language !== lang) setLang(patch.language);
            }
          };
          return (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <Card title={t('m14.profile.details')}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-[16px] font-semibold text-eyebrow" aria-hidden>
                      {p.initials || p.display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-[17px] font-semibold">{pick({ n_en: p.display_name, n_ar: p.display_name_ar || p.display_name }, 'n')}</div>
                      <div className="text-[12.5px] text-ink-3">{t('m14.profile.noPhoto')}</div>
                    </div>
                  </div>
                  <KeyValue
                    items={[
                      [t('m14.profile.kind'), t(`m14.kind.${p.kind}`)],
                      [t('m14.profile.org'), org ? pick(org, 'name') : '—'],
                      [t('m14.profile.role'), role ? pick(role, 'title') : '—'],
                      [t('m14.profile.family'), family ? pick(family, 'name') : '—'],
                      [t('m14.profile.team'), [p.team_id, p.crew, p.unit].filter(Boolean).join(' · ') || '—'],
                      [t('m14.profile.level'), p.level ? t(`m14.level.${p.level}`) : '—'],
                      [t('m14.profile.hire'), p.hire_date ? f.date(p.hire_date, 'long') : '—'],
                      [t('m14.profile.status'), <StatusPill key="s" status={p.status} />],
                    ]}
                  />
                  {p.synthetic && <p className="mt-3 text-[12px] text-ink-3">{t('m14.profile.synthetic')}</p>}
                </Card>

                <Card title={t('m14.profile.prefs')}>
                  <div className="grid gap-4 sm:grid-cols-2" data-testid="m14-profile-prefs">
                    <RadioGroup name="language" label={t('m14.profile.language')} value={p.language} onChange={(v) => setPref({ language: v as 'en' | 'ar' })} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
                    <RadioGroup name="digits" label={t('m14.profile.digits')} value={p.digits} onChange={(v) => setPref({ digits: v as 'latn' | 'arab' })} options={[{ value: 'latn', label: '0123456789' }, { value: 'arab', label: '٠١٢٣٤٥٦٧٨٩' }]} />
                  </div>
                  <p className="mt-3 text-[12.5px] text-ink-2">
                    {t('m14.profile.moreSettings')} <L to="/my/settings" className="font-semibold text-eyebrow hover:underline">{t('m14.routes.my-settings.title')}</L>
                  </p>
                </Card>

                <Card title={t('m14.profile.rolesTitle')}>
                  {assignments.length === 0 ? (
                    <p className="text-[13px] text-ink-3">{t('m14.profile.noRoles')}</p>
                  ) : (
                    <ul className="space-y-2" data-testid="m14-profile-roles">
                      {assignments.map((a) => {
                        const rv = accessReviewState(a);
                        return (
                          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                            <div>
                              <div className="font-semibold">{roleLabel(a.role as PlatformRole, lang)}</div>
                              <div className="text-[12px] text-ink-3">
                                {t('m14.profile.scope', { scope: t(`m14.scope.${a.scope_type}`), value: a.scope_value ?? '' })} · {t('m14.profile.since', { date: f.date(a.granted_at) })}
                                {a.expires_at ? ` · ${t('m14.profile.until', { date: f.date(a.expires_at) })}` : ''}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <StatusPill status={a.status === 'pending_second' ? 'pending' : a.status}>{t(`m14.access.st.${a.status}`)}</StatusPill>
                              {rv === 'due' || rv === 'overdue' ? <StatusPill status={rv}>{t(`m14.access.review.${rv}`)}</StatusPill> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {s.persona?.nexus && <Callout tone="info">{t('m14.profile.nexusRoles')}</Callout>}
                </Card>
              </div>

              <div className="space-y-4">
                <Card title={t('m14.profile.whatWeKeep')}>
                  <ul className="list-disc space-y-1 ps-5 text-[13px] text-ink-2">
                    <li>{t('m14.profile.keep1')}</li>
                    <li>{t('m14.profile.keep2')}</li>
                    <li>{t('m14.profile.keep3')}</li>
                  </ul>
                  <div className="caps mt-3">{t('m14.profile.notKept')}</div>
                  <ul className="mt-1 list-disc space-y-1 ps-5 text-[13px] text-ink-2">
                    <li>{t('m14.profile.not1')}</li>
                    <li>{t('m14.profile.not2')}</li>
                    <li>{t('m14.profile.not3')}</li>
                  </ul>
                </Card>
                <Card title={t('m14.profile.correctTitle')}>
                  <p className="text-[13px] text-ink-2">{t('m14.profile.correctBody')}</p>
                  <button className="btn-outline btn-sm mt-3" onClick={() => setCorrecting(true)} data-testid="m14-correction">{t('m14.profile.correctBtn')}</button>
                  {requests.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-[12.5px]">
                      {requests.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{r.note ?? '—'}</span>
                          <span className="flex shrink-0 items-center gap-1 text-ink-3">{f.date(r.created_at)} <StatusPill status={r.status} /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
              <Correction open={correcting} onClose={() => setCorrecting(false)} personId={p.id} />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function Correction({ open, onClose, personId }: { open: boolean; onClose: () => void; personId: string }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ field: 'role', note: '' }, { note: [required(), minLen(10)] });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('m14.profile.correctTitle')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={form.submitting}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.insert('data_requests', { person_id: personId, kind: 'correction', status: 'open', note: `[${v.field}] ${v.note}` }), { success: t('m14.profile.correctSent') });
              if (r.ok) {
                form.reset();
                onClose();
              }
            })}
            data-testid="m14-correction-send"
          >
            {t('m14.profile.correctSend')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <RadioGroup label={t('m14.profile.correctField')} {...form.field('field')} options={['name', 'role', 'org', 'qualification', 'licence', 'other'].map((x) => ({ value: x, label: t(`m14.profile.fields.${x}`) }))} />
        <TextArea label={t('m14.profile.correctNote')} required rows={3} {...form.field('note')} hint={t('m14.profile.correctHint')} />
      </div>
    </Modal>
  );
}

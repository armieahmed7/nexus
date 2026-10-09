// M14 · /my/settings: language, digits, calendar, theme and notification preferences (user_settings, applied to the
// interface at once), consents with withdrawal, data-subject requests (view, export, correction, deletion) and a
// self-service JSON export of the person's own records (feature flag self_export).
import { useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useI18n, useT } from '../../i18n';
import { Async, Callout, Card, CheckboxField, EmptyState, Modal, Page, RadioGroup, StatusPill, TextArea, downloadText, minLen, required, useForm } from '../../ui';
import type { Table, UserSettingsRow } from '../../data/types';
import { GatedConfirm } from '../m16/parts';
import { useFlags } from '../m16/flags';
import { RecoControlsCard } from '../m16/RecoControlsCard'; // W3E5 (F24): recommendations and your data

/** Tables whose own rows go into the self-service export (each is read through RLS with an explicit person filter). */
export const EXPORT_TABLES: Table[] = ['people', 'role_assignments', 'consents', 'user_settings', 'notifications', 'data_requests', 'qual_records', 'licences', 'enrolments', 'training_records', 'dev_plans', 'plan_activities', 'applications', 'advisor_sessions'];

export default function MySettingsPage() {
  const t = useT();
  const f = useFormat();
  const { lang, setLang, prefs, setPrefs } = useI18n();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const flags = useFlags();
  const me = s.identity.personId;
  const [withdraw, setWithdraw] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const data = useQuery(
    ['user_settings', 'consents', 'data_requests'],
    async () => {
      if (!me) return null;
      const mine = { filter: { person_id: me } } as const;
      const [settings, consents, requests] = await Promise.all([repo.list('user_settings', mine), repo.list('consents', { ...mine, order: [['granted_at', 'desc']] }), repo.list('data_requests', { ...mine, order: [['created_at', 'desc']] })]);
      return { settings: settings[0] ?? null, consents, requests };
    },
    [me],
  );

  const save = async (current: UserSettingsRow | null, patch: Partial<UserSettingsRow>) => {
    const r = current ? await run(() => repo.update('user_settings', current.id, patch), { success: t('m14.settings.saved') }) : await run(() => repo.insert('user_settings', { person_id: me!, language: lang, digits: prefs.digits, calendar: prefs.calendar, ...patch }), { success: t('m14.settings.saved') });
    if (!r.ok) return;
    if (patch.digits) setPrefs({ digits: patch.digits });
    if (patch.calendar) setPrefs({ calendar: patch.calendar });
    if (patch.theme) applyTheme(patch.theme);
    if (patch.language && patch.language !== lang) setLang(patch.language);
  };

  const exportAll = async () => {
    if (!me) return;
    setExporting(true);
    try {
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), person_id: me, note: t('m14.settings.exportNote') };
      for (const tbl of EXPORT_TABLES) {
        const col = tbl === 'people' ? 'id' : 'person_id';
        out[tbl] = await repo.list(tbl, { filter: { [col]: me } } as never).catch(() => []);
      }
      downloadText(`kafaa-my-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2), 'application/json');
      await run(() => repo.insert('data_requests', { person_id: me, kind: 'export', status: 'closed', note: t('m14.settings.exportLogged') }), { success: t('m14.settings.exportDone') });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Page title={t('m14.routes.my-settings.title')} intro={t('m14.settings.intro')}>
      <Async state={data} isEmpty={(d) => !d} empty={<EmptyState title={t('m14.my.noProfile')}>{t('m14.profile.noRowBody')}</EmptyState>}>
        {(raw) => {
          const { settings: st, consents, requests } = raw!;
          const cur = {
            language: st?.language ?? lang,
            digits: st?.digits ?? prefs.digits,
            calendar: st?.calendar ?? prefs.calendar,
            theme: st?.theme ?? 'light',
            notify_inapp: st?.notify_inapp ?? true,
            notify_email: st?.notify_email ?? false,
          };
          return (
            <div className="space-y-4">
              <Card title={t('m14.settings.display')}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m14-settings-display">
                  <RadioGroup name="set-lang" label={t('m14.profile.language')} value={cur.language} onChange={(v) => save(st, { language: v as 'en' | 'ar' })} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
                  <RadioGroup name="set-digits" label={t('m14.profile.digits')} value={cur.digits} onChange={(v) => save(st, { digits: v as 'latn' | 'arab' })} options={[{ value: 'latn', label: '0123456789' }, { value: 'arab', label: '٠١٢٣٤٥٦٧٨٩' }]} />
                  <RadioGroup name="set-cal" label={t('m14.settings.calendar')} value={cur.calendar} onChange={(v) => save(st, { calendar: v as 'gregorian' | 'hijri' })} options={[{ value: 'gregorian', label: t('m14.settings.gregorian') }, { value: 'hijri', label: t('m14.settings.hijri') }]} />
                  <RadioGroup name="set-theme" label={t('m14.settings.theme')} value={cur.theme} onChange={(v) => save(st, { theme: v as 'light' | 'dark' | 'system' })} options={['light', 'dark', 'system'].map((x) => ({ value: x, label: t(`m14.settings.themes.${x}`) }))} />
                </div>
                <p className="mt-3 text-[12.5px] text-ink-3">{t('m14.settings.preview', { date: f.date(new Date().toISOString(), 'long'), n: f.num(1234567.5) })}</p>
              </Card>

              <Card title={t('m14.settings.notifications')}>
                <div id="notifications" className="space-y-2">
                  <CheckboxField label={t('m14.settings.inapp')} hint={t('m14.settings.inappHint')} checked={cur.notify_inapp} onChange={(v) => save(st, { notify_inapp: v })} />
                  <CheckboxField label={t('m14.settings.email')} hint={t('m14.settings.emailHint')} checked={cur.notify_email} onChange={(v) => save(st, { notify_email: v })} />
                </div>
                <p className="mt-2 text-[12px] text-ink-3">{t('m14.settings.mandatory')}</p>
              </Card>

              <RecoControlsCard />

              <Card title={t('m14.settings.consents')}>
                {consents.length === 0 ? (
                  <p className="text-[13px] text-ink-3">{t('m14.settings.noConsents')}</p>
                ) : (
                  <ul className="space-y-2" data-testid="m14-consents">
                    {consents.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2.5">
                        <div>
                          <div className="font-semibold">{t(`m14.settings.consentType.${c.type}`) === `m14.settings.consentType.${c.type}` ? c.type : t(`m14.settings.consentType.${c.type}`)}</div>
                          <div className="text-[12.5px] text-ink-2">{c.purpose}</div>
                          <div className="text-[12px] text-ink-3">
                            {t('m14.settings.consentGiven', { date: f.date(c.granted_at), v: c.version })}
                            {c.withdrawn_at ? ` · ${t('m14.settings.consentWithdrawn', { date: f.date(c.withdrawn_at) })}` : ''}
                          </div>
                        </div>
                        {c.withdrawn_at ? <StatusPill status="withdrawn" /> : <button className="btn-outline btn-sm" onClick={() => setWithdraw(c.id)}>{t('m14.settings.withdraw')}</button>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title={t('m14.settings.rights')}>
                <p className="text-[13px] text-ink-2">{t('m14.settings.rightsBody')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-outline btn-sm" onClick={() => setRequesting(true)} data-testid="m14-request">{t('m14.settings.newRequest')}</button>
                  {flags.isOn('self_export') ? (
                    <button className="btn-primary btn-sm" onClick={exportAll} disabled={exporting} data-testid="m14-export">{exporting ? t('common.working') : t('m14.settings.exportNow')}</button>
                  ) : (
                    <StatusPill tone="neutral">{t('m14.settings.exportOff')}</StatusPill>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-ink-3">{t('m14.settings.exportScope', { n: EXPORT_TABLES.length })}</p>
                {requests.length > 0 && (
                  <ul className="mt-3 divide-y divide-line text-[13px]" data-testid="m14-requests">
                    {requests.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <span className="font-semibold">{t(`m14.settings.kinds.${r.kind}`)}</span>
                          {r.note && <span className="text-ink-2"> · {r.note}</span>}
                        </span>
                        <span className="flex items-center gap-2 text-[12px] text-ink-3">{f.date(r.created_at)} <StatusPill status={r.status} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Callout tone="info">{t('m14.settings.retention')}</Callout>

              <GatedConfirm
                open={!!withdraw}
                onClose={() => setWithdraw(null)}
                title={t('m14.settings.withdraw')}
                consequence={t('m14.settings.withdrawBody')}
                actingAs={t('m14.settings.asYou')}
                onConfirm={() => withdraw && run(() => repo.update('consents', withdraw, { withdrawn_at: new Date().toISOString() }), { success: t('m14.settings.withdrawn') })}
              />
              <NewRequest open={requesting} onClose={() => setRequesting(false)} personId={me!} />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  try {
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('kafaa.theme', dark ? 'dark' : 'light');
  } catch {
    /* ignore */
  }
}

function NewRequest({ open, onClose, personId }: { open: boolean; onClose: () => void; personId: string }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ kind: 'view', note: '' }, { kind: [required()], note: [required(), minLen(5)] });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('m14.settings.newRequest')}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            disabled={form.submitting}
            onClick={form.handleSubmit(async (v) => {
              const r = await run(() => repo.insert('data_requests', { person_id: personId, kind: v.kind as never, status: 'open', note: v.note }), { success: t('m14.settings.requestSent') });
              if (r.ok) {
                form.reset();
                onClose();
              }
            })}
            data-testid="m14-request-send"
          >
            {t('m14.settings.send')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <RadioGroup label={t('m14.settings.kind')} {...form.field('kind')} options={['view', 'export', 'correction', 'deletion'].map((x) => ({ value: x, label: t(`m14.settings.kinds.${x}`) }))} />
        {form.values.kind === 'deletion' && <Callout tone="sim">{t('m14.settings.deletionNote')}</Callout>}
        <TextArea label={t('m14.settings.note')} required rows={3} {...form.field('note')} />
        <p className="text-[12px] text-ink-3">{t('m14.settings.sla')}</p>
      </div>
    </Modal>
  );
}

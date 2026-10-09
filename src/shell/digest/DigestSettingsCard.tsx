// F36: nudge settings on /my/settings (anchor #digest-settings): on or off, frequency, quiet hours in Abu Dhabi time and muted
// kinds. Expiry reminders cannot be muted. Saved through rpc.setDigestPrefs (checked server-side, audited).
import { useEffect, useState } from 'react';
import { useAction, useRepo } from '../../data';
import { useT } from '../../i18n';
import { Card, CheckboxField, RadioGroup, SelectField, StatusPill } from '../../ui';
import { DIGEST_KINDS, FREQUENCIES, MUTABLE_KINDS, type DigestFrequency, type DigestPrefs } from './rules';
import { useDigest } from './useDigest';

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }));

export function DigestSettingsCard() {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const { view, me } = useDigest();
  const [p, setP] = useState<DigestPrefs | null>(null);
  useEffect(() => { if (view && !p) setP(view.prefs); }, [view, p]);
  if (!me || !p) return null;
  const quiet = p.quiet_start != null && p.quiet_end != null;
  const toggle = (k: string, on: boolean) => setP({ ...p, muted_kinds: on ? p.muted_kinds.filter((x) => x !== k) : [...p.muted_kinds, k] });
  const save = () => run(() => repo.rpc.setDigestPrefs({ enabled: p.enabled, frequency: p.frequency, quiet_start: p.quiet_start, quiet_end: p.quiet_end, muted_kinds: p.muted_kinds }));
  return (
    <div id="digest-settings" className="scroll-mt-20">
      <Card title={t('digest.settings.title')} actions={<StatusPill tone={p.enabled ? 'ok' : 'neutral'}>{p.enabled ? t('digest.settings.on') : t('digest.settings.off')}</StatusPill>}>
        <div className="space-y-4" data-testid="digest-settings">
          <p className="text-[13px] text-ink-2">{t('digest.settings.intro')}</p>
          <CheckboxField label={t('digest.settings.enabled')} hint={t('digest.settings.enabledHint')} checked={p.enabled} onChange={(v) => setP({ ...p, enabled: v })} />
          <div className={`grid gap-4 sm:grid-cols-2 ${p.enabled ? '' : 'opacity-60'}`}>
            <RadioGroup name="digest-frequency" label={t('digest.settings.frequency')} value={p.frequency} onChange={(v) => setP({ ...p, frequency: v as DigestFrequency })} options={FREQUENCIES.map((x) => ({ value: x, label: t(`digest.freq.${x}`) }))} />
            <div className="space-y-2">
              <CheckboxField label={t('digest.settings.quiet')} hint={t('digest.settings.quietHint')} checked={quiet} onChange={(v) => setP({ ...p, quiet_start: v ? 22 : null, quiet_end: v ? 6 : null })} />
              {quiet && (
                <div className="grid grid-cols-2 gap-2">
                  <SelectField name="quiet-start" label={t('digest.settings.from')} value={String(p.quiet_start)} onChange={(v) => setP({ ...p, quiet_start: Number(v) })} options={HOURS} />
                  <SelectField name="quiet-end" label={t('digest.settings.to')} value={String(p.quiet_end)} onChange={(v) => setP({ ...p, quiet_end: Number(v) })} options={HOURS} />
                </div>
              )}
            </div>
          </div>
          <fieldset className="space-y-1.5" data-testid="digest-kinds">
            <legend className="mb-1 text-[13px] font-semibold">{t('digest.settings.kinds')}</legend>
            {DIGEST_KINDS.map((k) => (
              <CheckboxField key={k} label={t(`digest.kind.${k}`)} hint={k === 'expiry' ? t('digest.settings.expiryLocked') : t(`digest.kindHint.${k}`)} checked={k === 'expiry' || !p.muted_kinds.includes(k)} disabled={k === 'expiry' || !MUTABLE_KINDS.includes(k)} onChange={(v) => toggle(k, v)} />
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary btn-sm" onClick={save} data-testid="digest-settings-save">{t('digest.settings.save')}</button>
            <span className="text-[12px] text-ink-3">{t('digest.settings.note')}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

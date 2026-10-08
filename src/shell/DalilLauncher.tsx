/**
 * Floating "Ask Dalil" launcher. Hidden when the kill switch is off (dalil_settings.enabled = false), on /ask itself,
 * and on /speak-up (M08: no assistant, no telemetry on that route).
 */
import { useQuery, useRepo } from '../data';
import { L, useT } from '../i18n';
import { Icon } from '../ui/Icon';
import type { RouteDef } from '../routes/types';

export function DalilLauncher({ route }: { route: RouteDef | null }) {
  const t = useT();
  const repo = useRepo();
  const q = useQuery('dalil_settings', () => repo.list('dalil_settings'));
  const enabled = q.data ? q.data.every((s) => s.enabled) : false;
  if (!enabled || route?.id === 'ask' || route?.id === 'speak-up' || route?.guard.noTelemetry) return null;
  return (
    <L to="/ask" className="link-plain no-print fixed bottom-4 end-4 z-30 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2.5 text-[13px] font-semibold shadow-card hover:border-accent" data-testid="dalil-launcher">
      <Icon name="sparkle" className="text-accent" />
      {t('shell.dalil.launch')}
    </L>
  );
}

// FS54 (wave F · E3): methodology-change banner for dashboards whose numbers move when the skills catalogue changes. Reads the public change
// log (kafaa_skill_changes, readable by every role) and shows the methodology changes published in the last BANNER_DAYS that touch the
// dashboard key. Mount it on a dashboard with <MethodologyBanner dashboard="skills_outlook" /> (the integration lead wires M07 F35 and the
// M35 FS51 pages: keys skills_outlook and skill_forecasts). Renders nothing when there is no recent change.
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Icon } from '../../ui';
import { todayIso } from '../../domain/rules';
import { BANNER_DAYS, methodologyNotices, type DashboardKey } from './taxonomyGov';

export function MethodologyBanner({ dashboard, today }: { dashboard: DashboardKey; today?: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['skill_changes'], () => repo.list('skill_changes', { order: [['effective_on', 'desc']] }).catch(() => []), []);
  const rows = methodologyNotices(q.data ?? [], dashboard, today ?? todayIso());
  if (!rows.length) return null;
  const kinds = [...new Set(rows.map((r) => r.kind))];
  return (
    <div role="status" className="flex items-start gap-3 rounded-card border border-sim-line bg-sim-bg p-3 text-[13px]" data-testid="m16-methodology-banner" data-dashboard={dashboard} data-n={rows.length}>
      <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-sim" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t('m16.mb.title', { date: f.date(rows[0].effective_on), n: f.num(rows.length) })}</p>
        <p className="text-ink-2">{t('m16.mb.body', { days: f.num(BANNER_DAYS), kinds: kinds.map((k) => t(`m16.gov.kind.${k}`)).join(t('m16.mb.sep')) })}</p>
        <p className="mt-1 truncate text-[12px] text-ink-3" title={pick(rows[0], 'summary')}>{t('m16.mb.latest')}: {pick(rows[0], 'summary')}</p>
      </div>
      <L to="/skills/changes" className="link shrink-0 text-[12.5px]" data-testid="m16-methodology-link">{t('m16.mb.link')}</L>
    </div>
  );
}
export default MethodologyBanner;

// FS wave E integration (QA lead): small M32 widgets other modules render (pages never import backend/*).
//  - CleanEnergyLink (FS41 -> FS14 green lane HZ-5 in M21): the CleanEnergyComp framework (/skills/clean-energy, public).
//  - EnergyTransitionLink (FS42 -> FS14 lanes HZ-9 / HZ-10): the value-chain explainers and pathway (/learn/energy-transition, staff).
//  - CecCitations (FS41 -> FS31, MC-CLEAN-ENERGY and any credential whose criteria a competence covers): which CleanEnergyComp
//    competences the criteria cite (cecCitations = SQL kafaa_cec_cites), each linked to its public competence page.
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { checkGuard } from '../../auth/guards';
import { ROUTES } from '../../routes/registry';
import { L, usePick, useT } from '../../i18n';
import { Card, Icon } from '../../ui';
import { cecCitations, type CecRow, type CriterionLite } from './cec';

export function CleanEnergyLink() {
  const t = useT();
  return (
    <p className="text-[12.5px]" data-testid="m32-clean-energy-link">
      <Icon name="globe" size={12} /> <L to="/skills/clean-energy">{t('m32.link.cec')}</L>
    </p>
  );
}

export function EnergyTransitionLink() {
  const t = useT();
  const s = useSession();
  const route = ROUTES.find((x) => x.path === '/learn/energy-transition');
  if (!route || checkGuard(route.guard, s) !== 'ok') return null;
  return (
    <p className="text-[12.5px]" data-testid="m32-energy-transition-link">
      <Icon name="link" size={12} /> <L to="/learn/energy-transition">{t('m32.link.transition')}</L>
    </p>
  );
}

/** The CleanEnergyComp competences a credential's criteria cite. Renders nothing when none does. */
export function CecCitations({ criteria }: { criteria: CriterionLite[] }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery('cec_competences', () => repo.list('cec_competences').catch(() => []), []);
  const comps = (q.data ?? []) as unknown as CecRow[];
  const cites = cecCitations(criteria, comps);
  if (!cites.length) return null;
  return (
    <div data-testid="m32-cec-citations"><Card title={t('m32.link.citesTitle')}>
      <p className="mb-2 text-[12.5px] text-ink-2">{t('m32.link.citesBody')}</p>
      <ul className="space-y-1.5 text-[13px]">
        {cites.map((c) => { const row = comps.find((x) => x.id === c.id)!; return (
          <li key={c.id} className="flex flex-wrap items-center gap-2" data-testid="m32-cec-cite" data-keys={c.keys.join(',')}>
            <span className="chip border-line bg-sunken text-ink-2">{c.code}</span>
            <L to={`/skills/clean-energy/${c.id}`}>{pick(row, 'name')}</L>
          </li>
        ); })}
      </ul>
      <p className="mt-2 text-[12px]"><L to="/skills/clean-energy">{t('m32.link.cec')}</L></p>
    </Card></div>
  );
}

/** F28 (W4 · E3): the "Scenarios and debriefs" tab on /training/simulator: library and coverage at a glance, booked crew slots
 *  that have run and still need a debrief, and the debrief form. */
import { useState } from 'react';
import { Async, Card, Grid, Icon, StatTile } from '../../ui';
import type { SimulatorSlotsRow } from '../../data/types';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { cycleCoverage } from './scenarios';
import { DebriefForm, asCycle, asDebriefLite, cycleOn, debriefableSlots, useSimDebriefs, useSimLibrary } from './simUi';

export function SimulatorScenariosTab({ slots }: { slots: SimulatorSlotsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const lib = useSimLibrary();
  const deb = useSimDebriefs();
  const [form, setForm] = useState<string | null>(null);
  return (
    <Async state={lib}>
      {(L0) => {
        const debriefs = deb.data ?? [];
        const done = new Set(debriefs.map((d) => d.slot_id));
        const pending = debriefableSlots(slots).filter((x) => !done.has(x.id));
        const today = new Date().toISOString().slice(0, 10);
        const cur = cycleOn(L0.cycles, 'coct', today);
        const cov = cur ? cycleCoverage(asCycle(cur), L0.items, L0.scMap, debriefs.map(asDebriefLite)) : null;
        return (
          <div className="space-y-4" data-testid="m04-sim-scenarios-tab">
            <Grid cols={4}>
              <StatTile label={t('m04.scn.tiles.approved')} value={f.num(L0.scenarios.filter((x) => x.status === 'approved').length)} sub={t('m04.scn.tiles.approvedSub', { n: L0.scenarios.length })} />
              <StatTile label={t('m04.scn.tiles.coverage')} value={cov ? f.pct(cov.pct, 0) : '—'} tone={cov && cov.missing + cov.under ? 'bad' : 'ok'} sub={cur ? pick(cur, 'label') : ''} />
              <StatTile label={t('m04.scn.tab2.pending')} value={f.num(pending.length)} tone={pending.length ? 'sim' : 'ok'} sub={t('m04.scn.tab2.pendingSub')} />
              <StatTile label={t('m04.scn.tiles.debriefs')} value={f.num(debriefs.length)} sub={debriefs[0] ? t('m04.scn.tab2.last', { date: f.date(debriefs[0].held_on) }) : ''} />
            </Grid>
            <Card title={t('m04.scn.tab2.awaiting')} actions={<L to="/training/simulator/scenarios" className="btn-outline btn-sm" data-testid="m04-sim-library-link"><Icon name="book" size={14} />{t('m04.scn.tab2.open')}</L>}>
              {!pending.length ? <p className="text-[13px] text-ink-2">{t('m04.scn.tab2.none')}</p> : (
                <ul className="divide-y divide-line">
                  {pending.slice(0, 8).map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                      <span>{f.dateTime(x.starts_at)} · {x.simulator} · {t('m04.common.crew')} {x.crew}</span>
                      {s.can('sat', ['W', 'A']) && <button className="btn-primary btn-sm" onClick={() => setForm(x.id)} data-testid={`m04-sim-debrief-${x.id}`}>{t('m04.scn.deb.new')}</button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {form && <DebriefForm open onClose={() => setForm(null)} lib={L0} slots={slots} initialSlot={form} />}
          </div>
        );
      }}
    </Async>
  );
}

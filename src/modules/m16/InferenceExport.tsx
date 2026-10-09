// F24 (W3 · E5): builds "what Kafa'a infers about me" from the same hooks the surfaces use (F01 states and evidence, F05
// readiness, F07 coach feed, F08 match scores), downloads it as JSON and records the export as a closed data request.
// Lazily loaded by RecoControlsCard; rendered only while an export runs.
import { useEffect, useMemo, useRef } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useLang, useT } from '../../i18n';
import { downloadText } from '../../ui';
import { useCoachData } from '../m19/useCoachData';
import { defaultTarget, useMarket, useMatches } from '../m20/ui';
import { useCareerBase, useReadiness } from '../m18/shared';
import { reachableRoles } from '../m18/career';
import { buildInferenceExport } from './inferences';
import { useRecoOptOut } from './optout';

export default function InferenceExport({ onDone }: { onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const coachOpt = useRecoOptOut('coach');
  const navOpt = useRecoOptOut('navigator');
  const mktOpt = useRecoOptOut('marketplace');
  const coach = useCoachData();
  const market = useMarket();
  const person = market.person as { job_role_id?: string | null; job_family_id?: string | null } | null | undefined;
  const target = market.q.data ? defaultTarget(market.q.data.paths, person?.job_role_id, market.q.data.shortlist) : null;
  const { ranked } = useMatches(market.q.data, target, person?.job_role_id ?? null, person?.job_family_id ?? null);
  const base = useCareerBase(me);
  const ids = useMemo(() => {
    const d = base.data;
    const role = d?.facts?.role_id;
    if (!d || !role) return [] as string[];
    return [...new Set([...reachableRoles(d.edges as never, role, 2).keys(), ...d.targets.filter((x) => x.active).map((x) => x.role_id)])];
  }, [base.data]);
  const rd = useReadiness(me, ids);
  const extra = useQuery(['skill_evidence', 'engine_cards', 'engine_settings', 'reco_optouts'], async () => {
    const [evidence, cards, settings, optouts] = await Promise.all([
      me ? repo.list('skill_evidence', { filter: { person_id: me } }).catch(() => []) : Promise.resolve([]),
      repo.list('engine_cards', { order: [['sort', 'asc']] }).catch(() => []),
      repo.list('engine_settings').catch(() => []),
      me ? repo.list('reco_optouts', { filter: { person_id: me } }).catch(() => []) : Promise.resolve([]),
    ]);
    return { evidence, cards, settings, optouts };
  }, [me]);
  const done = useRef(false);
  const ready = !!me && coach.q.data !== undefined && !!market.q.data && !!base.data && !!rd.data && !!extra.data && !coachOpt.loading && !navOpt.loading && !mktOpt.loading;
  const failed = !!(coach.q.error || market.q.error || base.error || rd.error || extra.error);

  useEffect(() => {
    if (done.current) return;
    if (failed) { done.current = true; void run(async () => ({ ok: false, code: 'error', message: t('m16.ai.export.failed') })); onDone(); return; }
    if (!ready) return;
    done.current = true;
    const d = base.data!;
    const json = buildInferenceExport({
      personId: me!, generatedAt: new Date().toISOString(), lang,
      skills: d.skills, states: d.states as never, evidence: extra.data!.evidence as never,
      readiness: [...rd.data!.values()].map((r) => ({ role_id: r.role_id, pct: r.pct, band: r.band, months: r.months, gate_status: r.gate_status, reasons: r.reasons as never })),
      roles: d.roles,
      coach: { opted_out: coachOpt.optedOut, items: (coach.result?.feed ?? []).map((c) => ({ id: c.id, kind: c.kind, itemId: c.itemId, score: c.score, reasons: c.reasons })) },
      opportunities: { opted_out: mktOpt.optedOut, items: ranked.slice(0, 20) as never },
      navigatorOptedOut: navOpt.optedOut,
      optouts: extra.data!.optouts.map((o) => ({ surface: o.surface, opted_out: o.opted_out, updated_at: o.updated_at })),
      cards: extra.data!.cards.map((c) => ({ id: c.id, engine_surface: c.engine_surface, version: c.version })),
      engines: extra.data!.settings.map((x) => ({ surface: x.surface, engine: x.engine, weights: (x.weights ?? {}) as Record<string, number> })),
    });
    downloadText(`kafaa-ai-inferences-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(json, null, 2), 'application/json');
    void run(() => repo.insert('data_requests', { person_id: me!, kind: 'export', status: 'closed', note: t('m16.ai.export.logged') }), { success: t('m16.ai.export.done') }).finally(onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, failed]);
  return <span className="text-[12.5px] text-ink-3" role="status" aria-live="polite" data-testid="m16-export-running">{t('m16.ai.export.running')}</span>;
}

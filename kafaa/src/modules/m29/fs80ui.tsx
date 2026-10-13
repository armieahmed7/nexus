// FS80 automation and agent gallery: shared module-local UI (data hooks, chips, the adoption counter, the builder-credit panel, the
// "metadata only" notice and a localized action helper). Pages import from here. Nothing in this file runs an automation: entries are
// descriptions rendered as plain text (no links, no HTML from the data).
import type { ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Callout, Icon, SimChip, StatusPill, WhyThis, useToast } from '../../ui';
import type { Result } from '../../data/types';
import type { Reason } from '../../domain/engines/types';
import { BUILDER_LEVEL_REUSE, REUSE_AT, adoptProblem, builderLevel, creditReasons } from './automations';
import { MaturityPill } from './fs36ui';
import { RungPill, type Row } from './ui';
import type { AiFluencyView } from './backend/rpc';

export const FS80 = ['UAE-PEERS', 'AI-LIT'];
const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);

/** Everything the gallery pages read: the entries the caller may see (RLS), the caller's own adoptions, the register rows, people
 *  names and the caller's FS09 rung (for the adoption gate). */
export function useGallery() {
  const repo = useRepo();
  const s = useSession();
  const pid = s.identity.personId;
  return useQuery(['automations', 'automation_adoptions', 'ai_systems', 'person_skills', 'skill_evidence'], async () => {
    const [entries, mine, systems, me, evidence] = await Promise.all([
      safe(repo.list('automations' as never, { order: [['decided_at', 'desc']] } as never)),
      safe(repo.list('automation_adoptions' as never, { filter: { person_id: pid ?? '__none__' } } as never)),
      safe(repo.list('ai_systems' as never, { order: [['sort', 'asc']] } as never)),
      pid ? repo.rpc.aiFluency().catch(() => null) : Promise.resolve(null),
      safe(repo.list('skill_evidence', { filter: { person_id: pid ?? '__none__', ref_table: 'automations' } } as never)),
    ]);
    return { entries, mine, systems, me: me as AiFluencyView | null, evidence, pid, person: s.person as Row | null };
  }, [pid]);
}
export type GalleryData = NonNullable<ReturnType<typeof useGallery>['data']>;

/** Who acted in an entry's history: the builder or AI governance (staff cannot read other people's rows; names live on the entry). */
export function useActor() {
  const t = useT();
  const pick = usePick();
  return (a: Row, h: Row) => (h.by === a.builder_person_id ? pick(a, 'builder') : t('m29.atm.by.governance'));
}

export function KindChip({ kind }: { kind: string }) {
  const t = useT();
  const icon = kind === 'agent' ? 'sparkle' : kind === 'report' ? 'chart' : kind === 'template' ? 'book' : 'reset';
  return <span className="chip border-line bg-panel normal-case tracking-normal text-ink-2" data-testid="m29-atm-kind" data-kind={kind}><Icon name={icon} size={12} /> {t(`m29.atm.kind.${kind}`)}</span>;
}
export function DataClassChips({ classes }: { classes: string[] }) {
  const t = useT();
  return (
    <span className="flex flex-wrap gap-1" data-testid="m29-atm-classes">
      {(classes ?? []).map((c) => (
        <span key={c} className={`chip normal-case tracking-normal ${c === 'personal' ? 'border-sim-line bg-sim-bg text-sim' : 'border-line bg-sunken text-ink-2'}`} data-class={c}>{t(`m29.atm.class.${c}`)}</span>
      ))}
    </span>
  );
}
export function AtmStatus({ status }: { status: string }) {
  const tone = status === 'approved' ? 'ok' : status === 'submitted' ? 'info' : status === 'returned' ? 'sim' : status === 'rejected' ? 'bad' : 'neutral';
  return <StatusPill tone={tone}><span data-testid="m29-atm-status" data-status={status}>{useT()(`common.status.${status}`)}</span></StatusPill>;
}
/** The register row an entry runs on: name, maturity, SIMULATED chip, link to /workspace/ai-register/:id. */
export function SystemLink({ sys }: { sys: Row | undefined }) {
  const t = useT();
  const pick = usePick();
  if (!sys) return <span className="text-[12.5px] text-ink-3">{t('m29.atm.sysHidden')}</span>;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="m29-atm-system" data-system={sys.id}>
      <Icon name="shield" size={12} />
      {sys.status === 'published' ? <L to={`/workforce/ai-register/${sys.id}`} className="min-w-0 break-words">{pick(sys, 'name')}</L> : <span className="min-w-0 break-words">{pick(sys, 'name')}</span>}
      <MaturityPill maturity={sys.maturity} />
      {sys.simulated && <SimChip label={t('m29.reg.simulated')} />}
      {sys.status !== 'published' && <StatusPill status={sys.status} />}
    </span>
  );
}
/** The adoption counter: number of colleagues who reuse the entry. */
export function Counter({ n, big }: { n: number; big?: boolean }) {
  const t = useT();
  const f = useFormat();
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${big ? 'text-[28px] font-semibold leading-none' : 'text-[13px]'}`} data-testid="m29-atm-counter" data-n={n}>
      <Icon name="users" size={big ? 18 : 13} />
      <span className="num">{f.num(n)}</span>
      <span className={big ? 'text-[13px] font-normal text-ink-3' : 'text-ink-3'}>{t(n === 1 ? 'm29.atm.adopter' : 'm29.atm.adopters')}</span>
    </span>
  );
}
/** Why an entry is in the gallery (WhyThis reasons; not a ranking: the gallery lists every approved entry). */
export function listedReasons(a: Row, sys: Row | undefined): Reason[] {
  const out: Reason[] = [{ code: 'approved', key: 'm29.atm.why.approved', vars: { date: String(a.decided_at ?? '').slice(0, 10) } }];
  if (sys) out.push({ code: 'register', key: 'm29.atm.why.register', vars: { system: { en: sys.name_en, ar: sys.name_ar } }, ref: { table: 'ai_systems', id: sys.id } });
  out.push({ code: 'rung', key: 'm29.atm.why.rung', vars: { rung: Number(a.min_rung) } });
  out.push({ code: 'metadata', key: 'm29.atm.why.metadata' });
  return out;
}

/** "Metadata only" notice: Kafa'a never runs an automation. */
export function MetadataNotice() {
  const t = useT();
  return <Callout tone="info" title={t('m29.atm.meta.title')}><span data-testid="m29-atm-metadata">{t('m29.atm.meta.body')}</span></Callout>;
}

/** Builder credit of an entry: level, the rule and why (visible to everyone who can read the entry). */
export function CreditPanel({ a }: { a: Row }) {
  const t = useT();
  const f = useFormat();
  const n = Number(a.adoption_count);
  const lvl = builderLevel(a.status, n);
  const toNext = lvl > 0 && lvl < BUILDER_LEVEL_REUSE ? REUSE_AT - n : 0;
  return (
    <div className="space-y-2" data-testid="m29-atm-credit" data-level={lvl}>
      <div className="flex flex-wrap items-center gap-2">
        {lvl > 0
          ? <StatusPill tone="ok">{t('m29.atm.credit.level', { n: f.num(lvl) })}</StatusPill>
          : <StatusPill tone="neutral">{t('m29.atm.credit.none')}</StatusPill>}
        <WhyThis reasons={creditReasons(a as never)} testId="m29-atm-credit-why" />
      </div>
      <p className="text-[13px] text-ink-2">{lvl > 0 ? (toNext > 0 ? t('m29.atm.credit.toNext', { n: f.num(toNext) }) : t('m29.atm.credit.top')) : t('m29.atm.credit.rule')}</p>
    </div>
  );
}

/** Why the caller can or cannot adopt (null = can). */
export function adoptBlock(a: Row, d: Pick<GalleryData, 'mine' | 'me' | 'pid'>): string | null {
  if (!d.pid || !d.me) return 'signin';
  return adoptProblem(a as never, { person_id: d.pid, rung: d.me.result.rung }, d.mine.some((x: Row) => x.automation_id === a.id), null);
}
export function AdoptHint({ code, a, me }: { code: string; a: Row; me: AiFluencyView | null }) {
  const t = useT();
  if (code === 'rung_low') return <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2">{t('m29.atm.block.rung_low')} <RungPill rung={Number(a.min_rung)} /> <span className="text-ink-3">{t('m29.atm.block.you')}</span> <RungPill rung={me?.result.rung ?? 0} /> <L to="/my/ai-fluency/drills">{t('m29.atm.block.drills')}</L></span>;
  return <span className="text-[12.5px] text-ink-3" data-testid="m29-atm-block" data-code={code}>{t(`m29.atm.block.${code}`)}</span>;
}

/** Run an RPC and show a localized toast (refusal codes map to m29.atm.err.<code>, else the server message). */
export function useAtmRun() {
  const t = useT();
  const toast = useToast();
  return async <T,>(fn: () => Promise<Result<T>>, okKey: string): Promise<Result<T>> => {
    try {
      const r = await fn();
      if (r.ok) toast.push({ tone: 'ok', title: t(okKey) });
      else { const k = `m29.atm.err.${r.code}`; const msg = t(k); toast.push({ tone: 'bad', title: msg === k ? r.message : msg, detail: r.message }); }
      return r;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.push({ tone: 'bad', title: message });
      return { ok: false, code: 'error', message } as Result<T>;
    }
  };
}

/** A plain-text block that keeps line breaks (entry text is never rendered as HTML or links). */
export function Plain({ children, testId }: { children: ReactNode; testId?: string }) {
  return <p className="whitespace-pre-line break-words text-[14px] text-ink-2" data-testid={testId}>{children}</p>;
}

/** FS36 system page: the approved gallery entries that run on one register entry (RLS: listed rows only for staff). */
export function SystemAutomations({ systemId }: { systemId: string }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const q = useQuery(['automations'], () => safe(repo.list('automations' as never, { filter: { system_id: systemId, status: 'approved' } } as never)), [systemId]);
  const rows = (q.data ?? []) as Row[];
  return (
    <section className="space-y-2" data-testid="m29-sys-automations">
      <h2 className="text-[15px] font-semibold">{t('m29.atm.sysList.title')}</h2>
      <p className="text-[13px] text-ink-3">{t('m29.atm.sysList.intro')}</p>
      {rows.length ? (
        <ul className="flex flex-wrap gap-2">
          {rows.map((a) => <li key={a.id} className="card flex min-w-0 items-center gap-2 px-3 py-2 text-[13px]"><KindChip kind={a.kind} /><L to={`/workforce/ai-automations/${a.id}`} className="min-w-0 break-words">{pick(a, 'title')}</L><Counter n={Number(a.adoption_count)} /></li>)}
        </ul>
      ) : <p className="text-[13px] text-ink-3">{t('m29.atm.sysList.none')}</p>}
    </section>
  );
}

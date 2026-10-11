// FS15 (FS wave B · E5): concept future roles in the Career Navigator. Every concept role (FS05 lifecycle 'concept') is listed
// next to the current moves with readiness against its FS05 profile (rpc.futureRoleReadiness: the 2030 profile, else 2035),
// the bridge edge from my role, the top gaps with the profile's own "why" line, and the closest real transition evidence
// (rpc.transitionEvidence, suppressed under 10). Ranking runs through the engine kernel (useEngine('recommend').run) with the
// FS05 profile context, so the disabled model slot would receive the same candidates and context. Concept roles carry the
// "no vacancy, no deployment decision" banner everywhere; they are never "ready now".
import { useMemo } from 'react';
import { Section, EmptyState, StatusPill, Icon, WhyThis, Async, BenchmarkChips } from '../../ui';
import { useQuery } from '../../data';
import { useEngine } from '../../data/useEngine'; // direct import: avoids a circular chunk warning in the build
import { lintRanked } from '../../domain/engines/rank';
import type { Ranked } from '../../domain/engines/types';
import { useT, usePick, useFormat, L } from '../../i18n';
import type { ConceptReadiness, TransitionEvidence } from './futureRoles';
import { ConceptBanner, ConceptBandPill, ConceptChip, ConceptRing, TransitionNote, useFamilyLabels } from './futureUi';
import type { CareerBase } from './shared';

/** Deterministic order: a bridge from my role first, then readiness, then id. Reasons are the readiness reasons (lintRanked-clean). */
export function rankConcepts(list: ConceptReadiness[]): Ranked<ConceptReadiness>[] {
  return [...list]
    .sort((a, b) => Number(!!b.bridge?.mine) - Number(!!a.bridge?.mine) || b.score - a.score || (a.role_id < b.role_id ? -1 : 1))
    .map((r) => ({ id: r.role_id, score: r.score, reasons: r.reasons, item: r }));
}

export function FutureRolesSection(p: {
  d: CareerBase; me: string; myRole: string; concept: Map<string, ConceptReadiness>; transitions: Map<string, TransitionEvidence>;
  shortlisted: (roleId: string) => boolean; canAdd: boolean; onAdd: (roleId: string) => void; onOpen: (roleId: string) => void;
}) {
  const t = useT();
  const eng = useEngine('recommend');
  const list = useMemo(() => [...p.concept.values()], [p.concept]);
  const ranked = useQuery(['role_profile_versions'], async () => {
    const det = () => rankConcepts(list);
    const out = await eng.run(det, { candidates: list.map((r) => ({ id: r.role_id, profile_id: r.profile_id, horizon: r.horizon, pct: r.pct, gaps: r.gaps.map((g) => `${g.kind}:${g.ref_id}`) })), context: { surface: 'navigator', feature: 'FS15', person: p.me, role: p.myRole, concept: true } });
    if (lintRanked(out.results).length) throw new Error(lintRanked(out.results).join('; '));
    return out.results;
  }, [eng.kind, list, p.me, p.myRole]);
  const mine = list.filter((r) => r.bridge?.mine).length;
  return (
    <Section title={t('m18.fs15.title')} description={t('m18.fs15.desc', { n: list.length, mine })}>
      <div className="space-y-3" data-testid="m18-fs15">
        <BenchmarkChips feature="FS15" />
        <ConceptBanner compact />
        <Async state={ranked}>
          {(rs) => rs.length === 0 ? <EmptyState title={t('m18.fs15.none')} icon="sparkle" /> : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m18-fs15-list">
              {rs.map((x) => <ConceptCard key={x.id} d={p.d} r={x.item!} ev={p.transitions.get(x.id)} shortlisted={p.shortlisted(x.id)} canAdd={p.canAdd} onAdd={() => p.onAdd(x.id)} onOpen={() => p.onOpen(x.id)} />)}
            </ul>
          )}
        </Async>
      </div>
    </Section>
  );
}

function useReqName(d: CareerBase) {
  const pick = usePick();
  const skillById = useMemo(() => new Map(d.skills.map((s) => [s.id, s])), [d.skills]);
  return (kind: string, id: string) => (kind === 'skill' ? pick(skillById.get(id), 'name') : pick(d.compById.get(id), 'name')) || id;
}

function ConceptCard({ d, r, ev, shortlisted, canAdd, onAdd, onOpen }: { d: CareerBase; r: ConceptReadiness; ev?: TransitionEvidence; shortlisted: boolean; canAdd: boolean; onAdd: () => void; onOpen: () => void }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const name = useReqName(d);
  const fam = useFamilyLabels();
  const role = d.roleById.get(r.role_id);
  return (
    <li className="card flex flex-col gap-3 p-4" data-testid="m18-fs15-card" data-role={r.role_id}>
      <div className="flex items-start gap-3">
        <ConceptRing r={r} />
        <div className="min-w-0 flex-1">
          <div className="caps">{t('m18.fs15.profileOf', { horizon: r.horizon, v: f.num(r.version) })}</div>
          <h3 className="text-[16px] font-semibold leading-snug">{pick(role, 'title')}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5"><ConceptChip /><ConceptBandPill r={r} /></div>
          <BridgeLine d={d} r={r} />
        </div>
      </div>
      {r.gaps.length > 0 ? (
        <div>
          <div className="caps mb-1">{t('m18.fs15.topGaps', { n: f.num(r.gaps.length) })}</div>
          <ul className="space-y-1.5 text-[13px]" data-testid="m18-fs15-gaps">
            {r.gaps.slice(0, 3).map((g) => (
              <li key={`${g.kind}:${g.ref_id}`}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{name(g.kind, g.ref_id)}</span>
                  <span className="num text-ink-3">{t('m18.card.level', { from: f.num(g.have), to: f.num(g.need) })}</span>
                  {g.have === 0 && g.kind === 'skill' && <StatusPill tone="info">{t('m18.fs15.newSkill')}</StatusPill>}
                </div>
                {(g.why.en || g.why.ar) && <div className="text-[12px] text-ink-2">{pick({ w_en: g.why.en, w_ar: g.why.ar }, 'w')}</div>}
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="text-[13px] text-ok">{t('m18.fs15.noGaps')}</p>}
      <TransitionNote ev={ev} familyLabel={fam(role?.family_id)} />
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <WhyThis reasons={r.reasons} testId="m18-fs15-why" />
        <button className="btn-ghost btn-sm" onClick={onOpen} data-testid="m18-fs15-details">{t('m18.card.details')}</button>
        {shortlisted ? (
          <StatusPill tone="accent"><Icon name="check" size={12} className="me-1 inline" />{t('m18.card.shortlisted')}</StatusPill>
        ) : (
          <button className="btn-outline btn-sm" disabled={!canAdd} title={!canAdd ? t('m18.short.full') : undefined} onClick={onAdd} data-testid="m18-fs15-add"><Icon name="plus" size={13} />{t('m18.card.shortlist')}</button>
        )}
        <L to={`/my/career/roadmap?role=${r.role_id}`} className="btn-ghost btn-sm" data-testid="m18-fs15-roadmap">{t('m18.card.roadmap')}</L>
      </div>
    </li>
  );
}

function BridgeLine({ d, r }: { d: CareerBase; r: ConceptReadiness }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const b = r.bridge;
  const from = b?.from_role_id ? pick(d.roleById.get(b.from_role_id), 'title') : '';
  const text = !b ? t('m18.fs15.bridge.none') : !b.mine ? t('m18.fs15.bridge.other', { role: from, n: f.num(b.need_months) })
    : b.remaining_months > 0 ? t('m18.fs15.bridge.wait', { role: from, n: f.num(b.need_months), left: f.num(b.remaining_months) }) : t('m18.fs15.bridge.met', { role: from });
  return <div className="mt-1 text-[12.5px] text-ink-2" data-testid="m18-fs15-bridge" data-mine={String(!!b?.mine)}>{text}</div>;
}

/** Drawer body for a concept role: every requirement of its profile with have / need and why, the bridge and the evidence. */
export function ConceptDetail({ d, r, ev }: { d: CareerBase; r: ConceptReadiness | null; ev?: TransitionEvidence }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const name = useReqName(d);
  const fam = useFamilyLabels();
  if (!r) return <p className="text-ink-2">{t('m18.detail.loading')}</p>;
  const role = d.roleById.get(r.role_id);
  return (
    <div className="space-y-5" data-testid="m18-fs15-detail">
      <ConceptBanner />
      <div className="flex items-center gap-4">
        <ConceptRing r={r} size={72} />
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5"><ConceptChip /><ConceptBandPill r={r} /></div>
          <p className="text-[13px] text-ink-2">{t('m18.fs15.detailNote', { horizon: r.horizon })}</p>
          <WhyThis reasons={r.reasons} testId="m18-fs15-detail-why" />
        </div>
      </div>
      <BridgeLine d={d} r={r} />
      <TransitionNote ev={ev} familyLabel={fam(role?.family_id)} />
      <div>
        <h3 className="mb-2 font-semibold">{t('m18.fs15.gapsTitle', { n: f.num(r.gaps.length) })}</h3>
        {r.gaps.length === 0 ? <p className="text-[13px] text-ok">{t('m18.fs15.noGaps')}</p> : (
          <div className="overflow-x-auto">
            <table className="table-base w-full text-[13px]" data-testid="m18-fs15-detail-gaps">
              <thead><tr><th className="text-start">{t('m18.detail.competency')}</th><th className="text-start">{t('m18.detail.have')}</th><th className="text-start">{t('m18.detail.need')}</th><th className="text-start">{t('m18.fs15.why')}</th></tr></thead>
              <tbody>
                {r.gaps.map((g) => (
                  <tr key={`${g.kind}:${g.ref_id}`}>
                    <td>{name(g.kind, g.ref_id)} <span className="text-[11px] text-ink-3">· {t(`m18.importance.${g.importance}`)}</span></td>
                    <td className="num">{f.num(g.have)}</td>
                    <td className="num">{f.num(g.need)}</td>
                    <td className="text-[12px] text-ink-2">{pick({ w_en: g.why.en, w_ar: g.why.ar }, 'w') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <L to={`/careers/roles/${r.role_id}`} className="btn-outline btn-sm">{t('m18.detail.rolePage')}</L>
        <L to="/careers/horizons" className="btn-ghost btn-sm">{t('m18.fs15.horizons')}</L>
        <L to={`/my/career/roadmap?role=${r.role_id}`} className="btn-primary btn-sm" data-testid="m18-fs15-detail-roadmap">{t('m18.card.roadmap')}</L>
      </div>
    </div>
  );
}

// M20 · F23 shared page helpers: reference data and labels, status pills, member and engagement chips, the frozen skill snapshot.
import { useMemo, type ReactNode } from 'react';
import { useQuery, useRepo } from '../../data';
import type { JobFamiliesRow, JobRolesRow, OrganisationsRow, SkillsRow } from '../../data/types';
import { useFormat, usePick, useT } from '../../i18n';
import { Icon, StatusPill, Timeline, type PillTone } from '../../ui';
import { bandOf, type SnapshotSkill } from './reserve';

export const todayIso = () => new Date().toISOString().slice(0, 10);

export interface RefData { skills: SkillsRow[]; roles: JobRolesRow[]; families: JobFamiliesRow[]; orgs: OrganisationsRow[] }
export function useRefData() {
  const repo = useRepo();
  return useQuery(['skills', 'job_roles', 'job_families', 'organisations'], async (): Promise<RefData> => {
    const [skills, roles, families, orgs] = await Promise.all([
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.list('job_families', { order: [['sort', 'asc']] }),
      repo.list('organisations').catch(() => [] as OrganisationsRow[]),
    ]);
    return { skills, roles, families, orgs };
  });
}

export function useResLabels(d: RefData | undefined) {
  const pick = usePick();
  const t = useT();
  return useMemo(() => {
    const sk = new Map((d?.skills ?? []).map((s) => [s.id, s]));
    const ro = new Map((d?.roles ?? []).map((r) => [r.id, r]));
    const fa = new Map((d?.families ?? []).map((f) => [f.id, f]));
    const og = new Map((d?.orgs ?? []).map((o) => [o.id, o]));
    return {
      skill: (id: string) => (sk.get(id) ? pick(sk.get(id), 'name') : id),
      role: (id: string | null | undefined) => (id && ro.get(id) ? pick(ro.get(id), 'title') : t('m20.common.roleCard')),
      family: (id: string | null | undefined) => (id && fa.get(id) ? pick(fa.get(id), 'name') : t('m20.common.unknownFamily')),
      org: (id: string | null | undefined) => (id && og.get(id) ? pick(og.get(id), 'name') : id ?? ''),
    };
  }, [d, pick, t]);
}
export type ResLabels = ReturnType<typeof useResLabels>;

const ENG_ICON: Record<string, string> = { mentor: 'users', capture_interview: 'chat', instructor: 'grad', reviewer: 'book' };
export function EngChip({ kind }: { kind: string }) {
  const t = useT();
  return <span className="chip border-accent/30 bg-accent-soft text-eyebrow" data-eng={kind}><Icon name={ENG_ICON[kind] ?? 'briefcase'} size={12} />{t(`m20.res.eng.${kind}`)}</span>;
}
const KIND_TONE: Record<string, string> = { alumni: 'border-info-line bg-info-bg text-info', partner_alumni: 'border-line bg-sunken text-ink-2', pre_departure: 'border-ok-line bg-ok-bg text-ok' };
export function MemberKindChip({ kind }: { kind: string }) {
  const t = useT();
  return <span className={`chip ${KIND_TONE[kind] ?? 'border-line bg-sunken text-ink-2'}`} data-kind={kind}>{t(`m20.res.kind.${kind}`)}</span>;
}
export function BandChip({ departedOn, today }: { departedOn: string | null | undefined; today: string }) {
  const t = useT();
  return <span className="chip border-line bg-sunken text-ink-2"><Icon name="calendar" size={11} />{t(`m20.res.band.${bandOf(departedOn, today)}`)}</span>;
}
export function AvailChip({ availability, hours }: { availability: string; hours: number }) {
  const t = useT();
  const f = useFormat();
  const tone = availability === 'open' ? 'border-ok-line bg-ok-bg text-ok' : availability === 'paused' ? 'border-line bg-sunken text-ink-3' : 'border-sim-line bg-sim-bg text-sim';
  return <span className={`chip ${tone}`}>{t(`m20.res.avail.${availability}`)}{availability !== 'paused' && <span className="num">· {t('m20.res.hoursMonth', { n: f.num(hours) })}</span>}</span>;
}
const REQ_TONE: Record<string, PillTone> = { pending_hr: 'sim', open: 'ok', filled: 'info', closed: 'neutral', declined: 'bad' };
export function ReqPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status} tone={REQ_TONE[status] ?? 'neutral'}>{t(`m20.res.reqStatus.${status}`)}</StatusPill>;
}
const ENG_TONE: Record<string, PillTone> = { invited: 'accent', interested: 'info', handed_to_hr: 'ok', declined: 'bad', withdrawn: 'neutral', completed: 'ok' };
export function EngPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status} tone={ENG_TONE[status] ?? 'neutral'}>{t(`m20.res.engStatus.${status}`)}</StatusPill>;
}

/** The frozen skill snapshot: level dots per skill and the evidence basis it was frozen with. */
export function SnapshotSkills({ snapshot, lab, max = 12, testId = 'm20-res-snapshot' }: { snapshot: unknown; lab: ResLabels; max?: number; testId?: string }) {
  const t = useT();
  const list = ((snapshot as SnapshotSkill[]) ?? []).slice(0, max);
  if (!list.length) return <p className="text-[13px] text-ink-3">{t('m20.res.noSnapshot')}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid={testId}>
      {list.map((s) => (
        <li key={s.skill_id} className="chip border-line bg-panel text-ink" title={t('m20.res.levelBasis', { level: s.level, basis: t(`m20.res.basis.${s.basis}`) })}>
          <span className="max-w-[16rem] truncate">{lab.skill(s.skill_id)}</span>
          <span className="inline-flex gap-0.5" role="img" aria-label={t('m20.res.levelOf', { n: s.level })}>
            {[1, 2, 3, 4].map((i) => <span key={i} className={`inline-block h-1.5 w-1.5 rounded-full ${i <= s.level ? (s.basis === 'verified' ? 'bg-ok' : 'bg-accent') : 'bg-line'}`} />)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EngTimeline({ history, who }: { history: unknown; who: (id: string | null) => string }) {
  const t = useT();
  const f = useFormat();
  const items = (((history as { at: string; status: string; by: string | null; note: string | null }[]) ?? []).slice().reverse());
  return <Timeline items={items.map((h, i) => ({ id: `${h.at}-${i}`, when: f.dateTime(h.at), title: t(`m20.res.engStatus.${h.status}`), detail: <>{who(h.by)}{h.note ? <> · “{h.note}”</> : null}</>, tone: ENG_TONE[h.status] ?? 'neutral' }))} />;
}

/** "No contract, payment or contact data: just a handed-to-HR status." */
export function HandoffNote({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <p className="flex items-start gap-1.5 text-[12.5px] text-ink-3"><Icon name="lock" size={13} className="mt-0.5 shrink-0" /><span>{children ?? t('m20.res.handoffNote')}</span></p>
  );
}

export const IAEA_KLRM = { href: 'https://www.iaea.org/node/41993', label: 'IAEA NG-T-6.11 (2017) Knowledge Loss Risk Management in Nuclear Organizations' };
export const ENEC_SR = { href: 'https://www.enec.ae/doc/sustainability-program-2024-23102025-low-69009902e1673.pdf', label: 'ENEC Sustainability Report 2024' };

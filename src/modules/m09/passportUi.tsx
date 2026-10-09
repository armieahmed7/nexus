// F33 contractor passport: shared view model, the passport view, the equivalency pre-check panel and small helpers used by the partner
// pages (/partner/workforce/passport...), the evaluator page (/training/equivalency/passport/:personId) and the admin page. Pages never
// import a backend: everything goes through useRepo() and RLS (own passport, own organisation, ENEC evaluators).
import { useMemo, useState } from 'react';
import {
  Card, Section, Callout, Drawer, EmptyState, SelectField, WhyThis, Icon, StatusPill, SimChip, ConfirmDialog, Timeline, ProgressRing, downloadText, Grid, StatTile,
} from '../../ui';
import { useAction, useQuery, useRepo, type Result } from '../../data';
import { useT, usePick, useFormat, useLang, L } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { BasisChip, LevelMeter, SkillsRadar, BadgeMedal } from '../m17/ui';
import { radarByCompetency } from '../m17/passport';
import { competencyLevels } from '../../domain/engines/skills';
import { evidenceFromPassport, isSecuritySkill, securityCompsOf, type Precheck, type PrecheckTask } from './contractor';
import type { ContractorBadge } from './backend/rpc';
import { MStatus } from './shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;
export interface CpData {
  personId: string;
  person: Row | null;
  label: string | null;
  org: Row | null;
  states: Row[];
  evidence: Row[];
  skills: Row[];
  comps: Row[];
  roleComps: Row[];
  roles: Row[];
  certs: Row[];
  courses: Row[];
  engagements: Row[];
  requests: Row[];
  standards: Row[];
  tasks: Row[];
  targets: Row[];
  badges: ContractorBadge[];
}
const TABLES = ['person_skills', 'skill_evidence', 'certificates', 'contractor_engagements', 'equivalency_requests', 'badges', 'people', 'contract_role_targets', 'enrolments'] as const;

/** Everything one contractor passport needs; RLS decides what the viewer gets (nothing at all for another organisation). */
export function useCpData(personId: string | null) {
  const repo = useRepo();
  return useQuery([...TABLES], async (): Promise<CpData | null> => {
    if (!personId) return null;
    const L_ = (tbl: string, q: object = {}) => (repo.list(tbl as never, q as never) as Promise<Row[]>).catch(() => [] as Row[]);
    const [person, states, evidence, skills, comps, roleComps, roles, certs, courses, engagements, requests, standards, tasks, badges] = await Promise.all([
      repo.get('people', personId).catch(() => null) as Promise<Row | null>,
      L_('person_skills', { filter: { person_id: personId, active: true } }),
      L_('skill_evidence', { filter: { person_id: personId } }),
      L_('skills', { order: [['sort', 'asc']] }),
      L_('competencies'),
      L_('role_competencies'),
      L_('job_roles', { filter: { status: 'published' }, order: [['sort', 'asc']] }),
      L_('certificates', { filter: { person_id: personId } }),
      L_('courses'),
      L_('contractor_engagements', { filter: { person_id: personId }, order: [['started_on', 'desc']] }),
      L_('equivalency_requests', { filter: { person_id: personId }, order: [['submitted_at', 'desc']] }),
      L_('qual_standards', { order: [['code', 'asc']] }),
      L_('task_items', { order: [['sort', 'asc']] }),
      repo.rpc.contractorBadges(personId).catch(() => [] as ContractorBadge[]),
    ]);
    const orgId: string | null = person?.org_id ?? states[0]?.org_id ?? engagements[0]?.org_id ?? requests[0]?.org_id ?? null;
    if (!person && !states.length && !engagements.length && !requests.length) return null;
    const [org, targets] = await Promise.all([
      orgId ? (repo.get('organisations', orgId).catch(() => null) as Promise<Row | null>) : Promise.resolve(null),
      orgId ? L_('contract_role_targets', { filter: { org_id: orgId, active: true } }) : Promise.resolve([] as Row[]),
    ]);
    return { personId, person, label: requests[0]?.person_label ?? null, org, states, evidence, skills, comps, roleComps, roles, certs, courses, engagements, requests, standards, tasks, targets, badges };
  }, [personId]);
}

/** Display name: the person row (self, own organisation) or the request label (ENEC evaluators never read contractor names). */
export function cpName(d: CpData, t: (k: string, v?: Record<string, string | number>) => string, pick: (r: object | null | undefined, f: string) => string) {
  return d.person ? pick(d.person, 'display_name') : d.label ?? t('m09.cp.contractor');
}

export function useEvidenceLabel(d: CpData) {
  const t = useT();
  const pick = usePick();
  return (e: Row): { title: string; system: string } => {
    if (e.ref_table === 'certificates') {
      const c = d.certs.find((x) => x.id === e.ref_id);
      const co = d.courses.find((x) => x.id === c?.course_id);
      return { title: t('m09.cp.ev.cert', { no: e.ref_id, course: co ? `${co.code} · ${pick(co, 'title')}` : '' }), system: t('m09.cp.sys.academy') };
    }
    if (e.ref_table === 'equivalency_requests') {
      const r = d.requests.find((x) => x.id === e.ref_id);
      const s = d.standards.find((x) => x.id === r?.standard_id);
      return { title: t('m09.cp.ev.eq', { code: s?.code ?? e.ref_id }), system: t('m09.cp.sys.evaluator') };
    }
    if (e.ref_table === 'contractor_engagements') {
      const g = d.engagements.find((x) => x.id === e.ref_id);
      return { title: t('m09.cp.ev.eng', { code: g?.ref_code ?? e.ref_id, title: g ? pick(g, 'title') : '' }), system: g ? pick(g, 'supervisor_role') : t('m09.cp.sys.mirror') };
    }
    if (e.kind === 'rating') return { title: t('m09.cp.ev.rating'), system: t('m09.cp.sys.self') };
    if (e.ref_table === 'badges') return { title: t('m09.cp.ev.badge'), system: t('m09.cp.sys.wallet') };
    return { title: t(`m09.cp.kind.${e.kind}`), system: e.ref_table };
  };
}

export function OutlookPill({ outlook }: { outlook: string }) {
  const t = useT();
  const tone = outlook === 'likely_equivalent' || outlook === 'already_equivalent' ? 'ok' : outlook === 'training_likely' ? 'bad' : 'sim';
  return <StatusPill status={outlook} tone={tone}>{t(`m09.cp.outlook.${outlook}`)}</StatusPill>;
}
export function TaskPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status} tone={status === 'likely' ? 'ok' : status === 'partial' ? 'sim' : 'bad'}>{t(`m09.cp.task.${status}`)}</StatusPill>;
}
export function NotAuthority() {
  const t = useT();
  return <Callout tone="info" title={t('m09.cp.mirrorTitle')}>{t('m09.cp.mirrorBody')}</Callout>;
}

// ───────────── the passport
export function ContractorPassportView({ d, mode, precheckHref }: { d: CpData; mode: 'self' | 'admin' | 'evaluator'; precheckHref?: string }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const today = todayIso();
  const sec = useMemo(() => securityCompsOf(d.comps), [d.comps]);
  const skillBy = useMemo(() => new Map(d.skills.map((s) => [s.id, s])), [d.skills]);
  const visible = d.states.filter((s) => Number(s.level) > 0 && skillBy.has(s.skill_id) && !isSecuritySkill(skillBy.get(s.skill_id), sec));
  const have = useMemo(() => competencyLevels(visible as never, d.skills as never), [visible, d.skills]);
  const targetIds = [...new Set([d.person?.job_role_id, ...d.targets.map((x) => x.role_id)].filter(Boolean))] as string[];
  const [roleId, setRoleId] = useState<string>(targetIds[0] ?? '');
  const req = new Map(d.roleComps.filter((r) => r.role_id === roleId).map((r) => [r.competency_id, Number(r.required_level)]));
  const [open, setOpen] = useState<string | null>(null);
  const label = useEvidenceLabel(d);
  const name = cpName(d, t, pick);
  const validCerts = d.certs.filter((c) => c.status === 'valid' && (!c.valid_to || String(c.valid_to).slice(0, 10) >= today));
  const signed = d.engagements.filter((g) => g.status === 'signed_off');
  const decisions = d.evidence.filter((e) => e.active && e.ref_table === 'equivalency_requests');
  const lines = visible
    .map((s) => ({ s, skill: skillBy.get(s.skill_id), need: skillBy.get(s.skill_id)?.core ? req.get(skillBy.get(s.skill_id).competency_id) ?? null : null }))
    .sort((a, b) => Number(b.need != null) - Number(a.need != null) || Number(b.s.level) - Number(a.s.level) || (a.skill.sort ?? 0) - (b.skill.sort ?? 0));
  const role = d.roles.find((r) => r.id === roleId);
  const axes = roleId ? radarByCompetency(have, d.comps as never, d.roleComps as never, roleId) : [];
  const openSkill = open ? skillBy.get(open) : null;

  return (
    <div className="space-y-6" data-testid="m09-cp-passport">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent-soft text-[18px] font-semibold text-eyebrow" aria-hidden>{d.person?.initials || name.slice(0, 2)}</span>
          <div className="min-w-0 flex-1">
            <div className="caps">{t('m09.cp.passportEyebrow')}</div>
            <h2 className="truncate text-[20px] font-semibold" data-testid="m09-cp-name">{name}</h2>
            <div className="text-[13px] text-ink-2">
              {d.org ? pick(d.org, 'name') : t('m09.cp.orgHidden')}
              {d.person?.job_role_id && <> · {pick(d.roles.find((r) => r.id === d.person.job_role_id), 'title')}</>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip border-accent/30 bg-accent-soft text-eyebrow"><Icon name="shield" size={12} />{t('m09.cp.portable')}</span>
            <span className="chip border-line bg-sunken text-ink-2">{t(`m09.cp.viewer.${mode}`)}</span>
          </div>
        </div>
      </Card>

      <Grid cols={4}>
        <StatTile label={t('m09.cp.stat.skills')} value={f.num(visible.length)} sub={t('m09.cp.stat.skillsSub', { n: f.num(visible.filter((s) => s.basis !== 'claimed').length) })} />
        <StatTile label={t('m09.cp.stat.academy')} value={`${f.num(validCerts.length)} / ${f.num(d.certs.length)}`} sub={t('m09.cp.stat.academySub')} tone={validCerts.length ? 'ok' : undefined} />
        <StatTile label={t('m09.cp.stat.engagements')} value={f.num(signed.length)} sub={t('m09.cp.stat.engagementsSub')} sim />
        <StatTile label={t('m09.cp.stat.equivalency')} value={f.num(new Set(decisions.map((e) => e.ref_id)).size)} sub={t('m09.cp.stat.equivalencySub')} tone="info" />
      </Grid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card title={t('m09.cp.radarTitle')} actions={targetIds.length > 1 ? (
          <label className="text-[12.5px]"><span className="sr-only">{t('m09.cp.profile')}</span>
            <select className="input py-1 text-[12.5px]" value={roleId} onChange={(e) => setRoleId(e.target.value)} data-testid="m09-cp-profile">
              {targetIds.map((id) => <option key={id} value={id}>{pick(d.roles.find((r) => r.id === id), 'title')}</option>)}
            </select>
          </label>
        ) : undefined}>
          {axes.length >= 3 ? <SkillsRadar axes={axes} title={t('m09.cp.radarTitle')} roleLabel={pick(role, 'title')} /> : <EmptyState title={t('m09.cp.noProfile')} />}
          <p className="mt-2 text-[12px] text-ink-3">{t('m09.cp.radarNote')}</p>
        </Card>
        <Card title={t('m09.cp.skillsTitle')} actions={precheckHref ? <L to={precheckHref} className="btn-outline btn-sm" data-testid="m09-cp-to-precheck">{t('m09.cp.toPrecheck')}</L> : undefined} padded={false}>
          {lines.length === 0 ? <div className="p-4"><EmptyState title={t('m09.cp.noSkills')} /></div> : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="table-base w-full text-[13px]" data-testid="m09-cp-skills">
                <caption className="sr-only">{t('m09.cp.skillsTitle')}</caption>
                <thead className="sticky top-0 bg-raised"><tr><th scope="col">{t('m09.cp.col.skill')}</th><th scope="col">{t('m09.cp.col.level')}</th><th scope="col">{t('m09.cp.col.basis')}</th><th scope="col" className="text-end">{t('m09.cp.col.confidence')}</th></tr></thead>
                <tbody>
                  {lines.map(({ s, skill, need }) => (
                    <tr key={s.id} data-testid="m09-cp-skill" data-skill={s.skill_id}>
                      <th scope="row" className="text-start font-medium">{pick(skill, 'name')}<div className="text-[11.5px] font-normal text-ink-3">{skill.code}</div></th>
                      <td><LevelMeter level={Number(s.level)} required={need} size="sm" /></td>
                      <td><BasisChip basis={s.basis} onClick={() => setOpen(s.skill_id)} testId="m09-cp-basis" /></td>
                      <td className="num text-end">{f.num(Math.round(Number(s.confidence) * 100))}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CredentialsCard d={d} mode={mode} />
        <Card title={t('m09.cp.engTitle')} actions={<SimChip label={t('m09.cp.engChip')} />}>
          {d.engagements.length === 0 ? <EmptyState title={t('m09.cp.noEng')} /> : (
            <Timeline items={d.engagements.map((g) => ({
              id: g.id,
              when: `${f.date(g.started_on)} – ${g.ended_on ? f.date(g.ended_on) : t('m09.cp.ongoing')}`,
              title: `${g.ref_code} · ${pick(g, 'title')}`,
              detail: g.status === 'signed_off'
                ? t('m09.cp.engSigned', { who: pick(g, 'supervisor_role'), skills: (Array.isArray(g.skills) ? g.skills : []).map((x: Row) => `${skillBy.get(x.skill_id) ? pick(skillBy.get(x.skill_id), 'name') : x.skill_id} (${f.num(x.level)})`).join(', ') })
                : t('m09.cp.engOpen'),
              tone: g.status === 'signed_off' ? 'ok' : 'info',
            }))} />
          )}
        </Card>
      </div>

      {(mode !== 'self' || d.requests.length > 0) && (
        <Card title={t('m09.cp.eqTitle')}>
          {d.requests.length === 0 ? <EmptyState title={t('m09.cp.noEq')} /> : (
            <ul className="divide-y divide-line" data-testid="m09-cp-eq">
              {d.requests.map((r) => {
                const s = d.standards.find((x) => x.id === r.standard_id);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-medium">{s?.code}</span> · {pick(s, 'title')}<span className="block text-[12px] text-ink-3">{r.decided_at ? t('m09.cp.eqDecided', { date: f.date(r.decided_at) }) : t('m09.cp.eqSubmitted', { date: f.date(r.submitted_at) })}</span></span>
                    <MStatus status={r.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={() => exportPassport(d, name, visible, skillBy)} data-testid="m09-cp-export"><Icon name="download" size={14} />{t('m09.cp.export')}</button>
        <span className="self-center text-[12px] text-ink-3">{t('m09.cp.exportNote')}</span>
      </div>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={openSkill ? pick(openSkill, 'name') : ''}>
        {openSkill && (
          <div className="space-y-3" data-testid="m09-cp-evidence">
            <p className="text-[13px] text-ink-2">{t('m09.cp.evidenceIntro')}</p>
            {d.evidence.filter((e) => e.skill_id === openSkill.id).sort((a, b) => Number(b.active) - Number(a.active) || String(b.observed_on).localeCompare(String(a.observed_on))).map((e) => {
              const x = label(e);
              return (
                <div key={e.id} className={`rounded-card border border-line p-3 ${e.active ? '' : 'opacity-60'}`} data-testid="m09-cp-evidence-row">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{x.title}</span>
                    <BasisChip basis={e.basis} />
                  </div>
                  <div className="mt-1 text-[12.5px] text-ink-2">{x.system} · {f.date(e.observed_on)} · {t('m09.cp.levelN', { n: f.num(e.level) })}{!e.active && <> · {t('m09.cp.inactive')}</>}</div>
                </div>
              );
            })}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function CredentialsCard({ d, mode }: { d: CpData; mode: 'self' | 'admin' | 'evaluator' }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const today = todayIso();
  const [wrap, setWrap] = useState<Row | null>(null);
  const [issued, setIssued] = useState<ContractorBadge[]>([]);
  const badges = [...issued.filter((b) => !d.badges.some((x) => x.id === b.id)), ...d.badges];
  const course = (id: string) => d.courses.find((c) => c.id === id);
  const certState = (c: Row) => (c.status === 'revoked' ? 'revoked' : c.status !== 'valid' || (c.valid_to && String(c.valid_to).slice(0, 10) < today) ? 'expired' : 'valid');
  return (
    <Card title={t('m09.cp.credTitle')} footer={t('m09.cp.credNote')}>
      {d.certs.length === 0 && badges.length === 0 ? <EmptyState title={t('m09.cp.noCreds')} /> : (
        <div className="space-y-3">
          <ul className="space-y-2" data-testid="m09-cp-certs">
            {d.certs.map((c) => {
              const st = certState(c);
              const wrapped = badges.some((b) => b.course_id === c.course_id && b.status === 'active');
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line px-3 py-2">
                  <span className="min-w-0"><span className="font-medium">{course(c.course_id)?.code} · {pick(course(c.course_id), 'title')}</span>
                    <span className="block text-[12px] text-ink-3">{c.id} · {t('m09.cp.issued', { date: f.date(c.issued_on) })}{c.valid_to ? ` · ${t('m09.cp.validTo', { date: f.date(c.valid_to) })}` : ''}</span></span>
                  <span className="flex items-center gap-2">
                    <StatusPill status={st}>{t(`m09.cp.cert.${st}`)}</StatusPill>
                    {mode === 'self' && st === 'valid' && !wrapped && <button type="button" className="btn-outline btn-sm" onClick={() => setWrap(c)} data-testid="m09-cp-wrap">{t('m09.cp.wrap')}</button>}
                  </span>
                </li>
              );
            })}
          </ul>
          {badges.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m09-cp-badges">
              {badges.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-card border border-line p-2">
                  <BadgeMedal code={String((b.achievement as Row)?.code ?? '')} status={b.status} size={48} />
                  <span className="min-w-0 flex-1 text-[12.5px]">
                    <span className="block truncate font-medium">{pick(b.achievement, 'name')}</span>
                    <span className="block text-ink-3">{t('m09.cp.issued', { date: f.date(b.issued_on) })}</span>
                    <span className="mt-1 flex flex-wrap gap-2">
                      <L to={`/verify/badge/${b.public_slug}`} className="link-plain text-accent">{t('m09.cp.verify')}</L>
                      {b.credential && <button type="button" className="link-plain text-accent" onClick={() => downloadText(`kafaa-badge-${b.public_slug}.json`, JSON.stringify(b.credential, null, 2), 'application/json')}>{t('m09.cp.download')}</button>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!wrap}
        onClose={() => setWrap(null)}
        title={t('m09.cp.wrapTitle')}
        consequence={t('m09.cp.wrapConsequence', { course: wrap ? `${course(wrap.course_id)?.code ?? ''} · ${pick(course(wrap.course_id), 'title')}` : '' })}
        confirmLabel={t('m09.cp.wrap')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.issueContractorBadge(wrap!.id), { success: t('m09.cp.wrapped') });
          if (r.ok) {
            const list = await repo.rpc.contractorBadges(d.personId).catch(() => [] as ContractorBadge[]);
            setIssued(list);
          }
          setWrap(null);
        }}
      />
    </Card>
  );
}

function exportPassport(d: CpData, name: string, visible: Row[], skillBy: Map<string, Row>) {
  const doc = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiablePresentation', 'KafaaContractorPassport'],
    holder: { initials: d.person?.initials ?? name.slice(0, 2), organisation: d.org?.name_en ?? null },
    generated_on: todayIso(),
    notice: "Kafa'a contractor passport (demo). Not a FANR certificate, an ENEC qualification or an equivalency decision.",
    skills: visible.map((s) => ({ id: s.skill_id, code: skillBy.get(s.skill_id)?.code, level: Number(s.level), basis: s.basis, confidence: Number(s.confidence) })),
    verifiableCredential: d.badges.filter((b) => b.status === 'active' && b.credential).map((b) => b.credential),
  };
  downloadText(`kafaa-contractor-passport-${d.personId}.json`, JSON.stringify(doc, null, 2), 'application/json');
}

// ───────────── equivalency pre-check
export function PrecheckPanel({ d, canSubmit, initialStd }: { d: CpData; canSubmit: boolean; initialStd?: string | null }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const lang = useLang();
  const targetRoles = new Set([d.person?.job_role_id, ...d.targets.map((x) => x.role_id)].filter(Boolean));
  const stds = d.standards.filter((s) => s.status === 'current' && !s.security_restricted)
    .sort((a, b) => Number((b.role_ids ?? []).some((r: string) => targetRoles.has(r))) - Number((a.role_ids ?? []).some((r: string) => targetRoles.has(r))) || String(a.code).localeCompare(String(b.code)));
  const [std, setStd] = useState<string>(initialStd && stds.some((s) => s.id === initialStd) ? initialStd : stds[0]?.id ?? '');
  const [res, setRes] = useState<Result<Precheck> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const skillBy = new Map(d.skills.map((s) => [s.id, s]));
  const taskBy = new Map(d.tasks.map((x) => [x.id, x]));
  const courseBy = new Map(d.courses.map((x) => [x.id, x]));
  const go = async () => {
    setBusy(true);
    try { setRes(await repo.rpc.equivalencyPrecheck(d.personId, std)); } catch (e) { setRes({ ok: false, code: 'error', message: String(e) }); } finally { setBusy(false); }
  };
  const p = res?.ok ? res.data! : null;
  const evidence = evidenceFromPassport(d.certs, d.engagements, (id) => courseBy.get(id)?.code ?? id);
  const s = d.standards.find((x) => x.id === std);
  const label = d.person ? t('m09.cp.requestLabel', { initials: d.person.initials || '', role: pick(d.roles.find((r) => r.id === d.person.job_role_id), 'title') || t('m09.cp.contractor') }) : d.label ?? d.personId;
  return (
    <Section title={t('m09.cp.pcTitle')} description={t('m09.cp.pcDesc')}>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <SelectField label={t('m09.cp.pcStandard')} name="std" value={std} onChange={(v: string) => { setStd(v); setRes(null); }} options={stds.map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'title')}` }))} />
          </div>
          <button type="button" className="btn-primary" onClick={go} disabled={!std || busy} data-testid="m09-pc-run">{busy ? t('m09.cp.pcRunning') : t('m09.cp.pcRun')}</button>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">{t('m09.cp.pcSecurity')}</p>
      </Card>
      {res && !res.ok && <Callout tone="bad" title={t('m09.cp.pcRefused')}><span data-testid="m09-pc-refused" data-code={res.code}>{res.message}</span></Callout>}
      {p && (
        <div className="space-y-4" data-testid="m09-pc-result" data-outlook={p.outlook}>
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <ProgressRing value={p.coverage} size={72} tone={p.outlook === 'training_likely' ? 'bad' : p.coverage >= 80 ? 'ok' : 'accent'} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><OutlookPill outlook={p.outlook} /><span className="chip border-line bg-sunken text-ink-2">{t('m09.cp.pcDeterministic')}</span></div>
                <p className="mt-1 text-[13.5px] text-ink-2">{t(`m09.cp.outlookText.${p.outlook}`, { code: s?.code ?? '' })}</p>
                <p className="mt-1 text-[12.5px] text-ink-3">{t('m09.cp.pcCounts', { likely: f.num(p.likely), partial: f.num(p.partial), gaps: f.num(p.gaps), total: f.num(p.total), critical: f.num(p.critical_gaps) })}</p>
              </div>
              {canSubmit && !p.open_request_id && p.outlook !== 'already_equivalent' && (
                <button type="button" className="btn-primary" onClick={() => setConfirm(true)} data-testid="m09-pc-submit">{t('m09.cp.pcSubmit')}</button>
              )}
            </div>
            {p.open_request_id && <p className="mt-3 text-[12.5px] text-info" data-testid="m09-pc-open">{t('m09.cp.pcOpen', { id: p.open_request_id })}</p>}
            {p.prior_request_id && <p className="mt-1 text-[12.5px] text-ink-2">{t('m09.cp.pcPrior', { id: p.prior_request_id })}</p>}
          </Card>
          <Card title={t('m09.cp.pcTasks')} padded={false}>
            <ul className="divide-y divide-line" data-testid="m09-pc-tasks">
              {p.tasks.map((x: PrecheckTask) => {
                const task = taskBy.get(x.task_id);
                return (
                  <li key={x.task_id} className="flex flex-wrap items-start gap-3 px-4 py-3" data-testid="m09-pc-task" data-status={x.status}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{task ? (lang === 'ar' && task.statement_ar ? task.statement_ar : task.statement_en) : x.task_id}</span>
                        {x.critical && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m09.cp.critical')}</span>}
                        {x.prior && <span className="chip border-info-line bg-info-bg text-info">{t('m09.cp.priorChip')}</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {x.links.map((l) => (
                          <span key={l.skill_id} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                            {pick(skillBy.get(l.skill_id), 'name')} <LevelMeter level={l.have} required={l.need} size="sm" />
                            {l.basis !== 'none' && <BasisChip basis={l.basis} />}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="flex items-center gap-2"><TaskPill status={x.status} /><WhyThis reasons={x.reasons} testId="m09-pc-why" /></span>
                  </li>
                );
              })}
            </ul>
          </Card>
          {p.suggestions.length > 0 && (
            <Card title={t('m09.cp.pcSuggest')} footer={t('m09.cp.pcSuggestNote')}>
              <ul className="space-y-2" data-testid="m09-pc-suggestions">
                {p.suggestions.map((g) => {
                  const c = courseBy.get(g.id);
                  return (
                    <li key={g.id} className="flex flex-wrap items-center justify-between gap-2" data-testid="m09-pc-suggestion">
                      <span><span className="font-medium">{c?.code} · {pick(c, 'title')}</span> {c?.audience === 'supplier' ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('m09.cp.academyChip')}</span> : <span className="chip border-line bg-sunken text-ink-2">{t('m09.cp.enecChip')}</span>}</span>
                      <WhyThis reasons={g.reasons} testId="m09-pc-sug-why" />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m09.cp.pcSubmitTitle')}
        consequence={t('m09.cp.pcSubmitConsequence', { code: s?.code ?? '', n: String(evidence.length) })}
        confirmLabel={t('m09.cp.pcSubmit')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.submitEquivalency({ person_id: d.personId, person_label: label.slice(0, 80), standard_id: std, evidence: evidence.length ? evidence as never : [{ name: 'Kafa\'a contractor passport export', kind: 'other' }] as never }), { success: t('m09.cp.pcSubmitted') });
          setConfirm(false);
          if (r.ok) await go();
        }}
      >
        <ul className="mt-2 list-disc ps-5 text-[12.5px] text-ink-2">{evidence.map((e) => <li key={e.name}>{e.name}</li>)}</ul>
      </ConfirmDialog>
    </Section>
  );
}

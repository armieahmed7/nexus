// F03 Skills Passport: the shared view for /my/skills (own, editable) and /team/passport/:personId (scope, read-only).
// Profile header with mirrored qualifications and licence, skills radar against the role (and a target role), strengths for
// the next move (F02 engines, with reasons), "Expiring and decaying", the skills list with basis chips and the evidence
// drawer, and my claims. Kafa'a is not an authority: qualification and licence lines are mirrors.
import { useMemo, useState } from 'react';
import { Card, Section, Callout, Drawer, Modal, EmptyState, SelectField, TextArea, TextField, RadioGroup, FilterBar, useFilters, useForm, required, maxLen, minLen, WhyThis, EngineBadge, Icon, StatusPill, downloadText } from '../../ui';
import { useRepo, useAction, useEngine } from '../../data';
import { useT, usePick, useFormat, useLang, L, systemName } from '../../i18n';
import { todayIso } from '../../domain/rules';
import { skillReasons } from '../../domain/skills';
import { BasisChip, LevelMeter, MirrorChip, SkillsRadar, Stat, BadgeStatusPill, type PassportData } from './ui';
import {
  ageingSkills, expiringQuals, radarByCompetency, radarByDomain, refresherFor, securityComps, isSecuritySkill, transferableStrengths, badgeView, passportJson, isHttpUrl,
  LEVEL_MAX, NOTE_MAX, type PassportModel, type StateRow,
} from './passport';
import { qualView, licenceView } from '../../domain/rules';
import { BandChip, IntervalBar, SourceRecordView } from './confidenceUi'; // FS03
import { sourceRecord, type RecordRow } from './decay'; // FS03
import { AddGoalButton } from './goalsUi'; // FS33
import { useSession } from '../../auth/session';
import { trustTier, type CertLite, type TrustTier } from '../m34/extcerts'; // FS79 (wave I integration)
import { TrustTierBadge } from '../m34/fs91ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
export interface SkillLine { skill: Row; comp: Row | undefined; state: StateRow | null; required: number | null; evidence: Row[] }

/** Derived view model shared by the passport, the print page and the JSON export. */
export function usePassportModel(d: PassportData) {
  const pick = usePick();
  const eng = useEngine('match');
  const today = todayIso();
  return useMemo(() => {
    const person = d.person;
    const roleId: string | null = person?.job_role_id ?? null;
    const role = d.roles.find((r) => r.id === roleId) ?? null;
    const family = d.families.find((f) => f.id === (role?.family_id ?? person?.job_family_id)) ?? null;
    const sec = securityComps(d.comps);
    const compById = new Map(d.comps.map((c) => [c.id, c]));
    const skillById = new Map(d.skills.map((s) => [s.id, s]));
    const have = eng.skills.competencyLevels(d.states, d.skills);
    const req = new Map(d.roleComps.filter((r) => r.role_id === roleId).map((r) => [r.competency_id, r.required_level as number]));
    const stateBy = new Map(d.states.map((s) => [s.skill_id, s]));
    const evBy = new Map<string, Row[]>();
    for (const e of d.evidence) (evBy.get(e.skill_id) ?? evBy.set(e.skill_id, []).get(e.skill_id)!).push(e);
    const lines: SkillLine[] = [];
    for (const s of d.skills) {
      const st = stateBy.get(s.id) ?? null;
      const need = s.core ? req.get(s.competency_id) ?? null : null;
      if (!st && need == null) continue;
      lines.push({ skill: s, comp: compById.get(s.competency_id), state: st, required: need, evidence: evBy.get(s.id) ?? [] });
    }
    const roleReqLines = lines.filter((l) => l.required != null);
    const met = roleReqLines.filter((l) => (l.state?.level ?? 0) >= l.required!).length;
    const securityRoles = d.roles.filter((r) => r.security_sensitive).map((r) => r.id);
    const roleLabels = Object.fromEntries(d.roles.map((r) => [r.id, { en: r.title_en, ar: r.title_ar }]));
    const strengths = transferableStrengths({ states: d.states, skills: d.skills, comps: d.comps, have, roleComps: d.roleComps as never, edges: d.edges as never, currentRole: roleId, pathOnly: securityRoles, roleLabels, weights: eng.weights });
    const years = person?.hire_date ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(person.hire_date)) / (365.25 * 86_400_000))) : null;
    return { person, roleId, role, family, sec, compById, skillById, have, lines, roleReqLines, met, strengths, roleLabels, years, today,
      expiring: expiringQuals(d.quals, d.standards, today), ageing: ageingSkills(d.states.filter((s) => { const k = skillById.get(s.skill_id); return k && !isSecuritySkill(k, sec); }), today), securityRoles };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, eng, pick, today]);
}
export type PassportVM = ReturnType<typeof usePassportModel>;

/** Evidence row → what it is and where it was recorded (never task detail; security standards show status only). */
export function useEvidenceLabel(d: PassportData) {
  const t = useT();
  const pick = usePick();
  return (e: Row): { title: string; system: string; ref: string; tier?: TrustTier } => {
    const course = (id: string | undefined) => d.courses.find((c) => c.id === id);
    if (e.kind === 'qual') {
      const r = d.quals.find((q) => q.id === e.ref_id);
      const s = d.standards.find((x) => x.id === r?.standard_id);
      if (s?.security_restricted || r?.security_mirror_only) return { title: t('m17.evidence.securityQual'), system: systemName(t, r?.source_system), ref: e.ref_id };
      return { title: `${t('m17.evidence.kind.qual')} ${s?.code ?? ''} · ${pick(s, 'title')}`, system: systemName(t, r?.source_system), ref: e.ref_id };
    }
    if (e.kind === 'course') {
      const tr = d.training.find((x) => x.id === e.ref_id);
      const c = course(tr?.course_id);
      return { title: `${t('m17.evidence.kind.course')} ${c?.code ?? ''} · ${pick(c, 'title')}`, system: systemName(t, tr?.source_system ?? 'Training records system'), ref: e.ref_id };
    }
    if (e.kind === 'assessment' && e.ref_table === 'adaptive_attempts') return { title: t('m05.ad.evidenceLabel'), system: 'Kafa\'a', ref: e.ref_id }; // FS21: adaptive assessment
    if (e.kind === 'assessment' && e.ref_table === 'task_attempts') return { title: t('m05.pt.evidenceLabel'), system: 'Kafa\'a', ref: e.ref_id }; // FS22: performance task
    if (e.kind === 'assessment' && e.ref_table === 'fitness_attempts') return { title: t('m29.evidenceLabel'), system: 'Kafa\'a', ref: e.ref_id }; // FS10: AI and digital fitness check
    if (e.kind === 'assessment' && e.ref_table === 'ai_drill_attempts') return { title: t('m29.dr.evidenceLabel'), system: 'Kafa\'a', ref: e.ref_id }; // FS37: AI sandbox drill
    if (e.kind === 'assessment' && e.ref_table === 'twin_attempts') return { title: t('m31.tw.evidenceLabel'), system: 'Kafa\'a', ref: e.ref_id }; // FS40: digital-twin drill (wave E integration)
    if (e.kind === 'ojt' && e.ref_table === 'plant_visits') return { title: t('m31.pv.evidenceLabel'), system: 'Kafa\'a', ref: e.ref_id }; // FS39: host-confirmed plant visit (wave E integration)
    if (e.kind === 'rating' && (e.ref_table === 'lectures' || e.ref_table === 'knowledge_assets')) return { title: t('m24.ctb.evidenceLabel'), system: t('m24.ctb.evidenceSystem'), ref: e.ref_id }; // FS44: validated expert contribution (wave E integration)
    if (e.kind === 'rating' && e.ref_table === 'roleplay_sessions') return { title: t('m33.rp.evidenceLabel'), system: t('m33.rp.evidenceSystem'), ref: e.ref_id }; // FS59: reviewer-validated role-play feedback (wave F integration)
    if (e.kind === 'assessment') {
      const a = d.attempts.find((x) => x.id === e.ref_id);
      const c = course(d.forms.find((f) => f.id === a?.form_id)?.course_id);
      return { title: `${t('m17.evidence.kind.assessment')} ${c ? `${c.code} · ${pick(c, 'title')}` : ''}`, system: t('m17.evidence.sys.assess'), ref: e.ref_id };
    }
    if (e.kind === 'jpm') return { title: t('m17.evidence.kind.jpm'), system: t('m17.evidence.sys.jpm'), ref: e.ref_id };
    // FS wave I integration: evidence written by the wave-I features
    if (e.kind === 'credential' && e.ref_table === 'external_certs') { // FS79: a verified external certificate, with its trust tier
      const c = (d.xcerts ?? []).find((x) => x.id === e.ref_id);
      return { title: `${t('m17.evidence.kind.xcert')}${c ? ` · ${c.title}` : ''}`, system: c?.issuer ?? t('m17.evidence.sys.recognition'), ref: c?.credential_ref ?? e.ref_id, tier: c ? trustTier(c as CertLite) : undefined };
    }
    if (e.kind === 'ojt' && e.ref_table === 'automations') return { title: t('m17.evidence.kind.automation'), system: t('m17.evidence.sys.gallery'), ref: e.ref_id }; // FS80: builder credit (approved and adopted)
    if (e.kind === 'rating' && e.ref_table === 'grant_applications') return { title: t('m36.gr.evidenceLabel'), system: t('m17.evidence.sys.grants'), ref: e.ref_id }; // FS82: accepted micro-grant output
    if (e.kind === 'ojt' && e.ref_table === 'consortium_visits') return { title: t('m36.cc.evidenceLabel'), system: t('m17.evidence.sys.consortium'), ref: e.ref_id }; // FS83: host-confirmed consortium visit
    if (e.kind === 'credential' && e.ref_table === 'programme_alignments') return { title: t('m10.ua.evidenceLabel'), system: t('m10.ua.evidenceSystem'), ref: e.ref_id }; // FS66: graduate of an endorsed university programme, validated at hire (wave G integration)
    if (e.kind === 'credential' && e.ref_table === 'microcred_awards') { // FS03: back-filled micro-credential evidence
      const a = (d.mcAwards ?? []).find((x) => x.id === e.ref_id);
      return { title: `${t('m17.evidence.kind.credential')} ${a?.def_code ?? ''}`, system: t('m17.evidence.sys.wallet'), ref: a?.public_slug ?? e.ref_id };
    }
    if (e.kind === 'credential') {
      const b = d.badges.find((x) => x.id === e.ref_id);
      return { title: `${t('m17.evidence.kind.credential')} ${b ? pick(b.achievement, 'name') : ''}`, system: t('m17.evidence.sys.wallet'), ref: b?.public_slug ?? e.ref_id };
    }
    if (e.kind === 'rating') {
      const title = e.basis === 'validated' ? t('m17.evidence.kind.validated') : t('m17.evidence.kind.claim');
      const sys = e.ref_table === 'applications' ? t('m17.evidence.sys.application') : e.ref_table === 'people' ? t('m17.evidence.sys.onboarding') : t('m17.evidence.sys.passport');
      return { title: e.note ? `${title}: ${e.note}` : title, system: sys, ref: e.ref_id };
    }
    return { title: t(`m17.evidence.kind.${e.kind}`), system: t('m17.evidence.sys.passport'), ref: e.ref_id };
  };
}

/** Export model (no email, no photo, no task detail; security qualifications as qualified / not qualified only). */
export function useExportModel(d: PassportData, vm: PassportVM): PassportModel {
  const t = useT();
  const pick = usePick();
  const label = useEvidenceLabel(d);
  const lic = d.licences[0];
  return {
    generated_on: vm.today,
    holder: { name: pick(vm.person, 'display_name'), initials: vm.person?.initials ?? '' },
    role: pick(vm.role, 'title') || '—',
    family: pick(vm.family, 'name') || '—',
    years: vm.years,
    skills: [...vm.lines]
      .filter((l) => l.state && l.state.level > 0 && !isSecuritySkill(l.skill, vm.sec))
      .sort((a, b) => Number(b.required != null) - Number(a.required != null) || (b.state!.level - a.state!.level) || a.skill.sort - b.skill.sort)
      .map((l) => ({
        id: l.skill.id, code: l.skill.code, name: pick(l.skill, 'name'), area: l.skill.area, level: l.state!.level, basis: l.state!.basis, confidence: Number(l.state!.confidence), required: l.required,
        ...(l.state!.confidence_band ? { band: l.state!.confidence_band, interval: [Number(l.state!.conf_low), Number(l.state!.conf_high)] as [number, number] } : {}), // FS03
        evidence: l.evidence.map((e) => { const x = label(e); return { kind: e.kind, ref: x.title, observed_on: String(e.observed_on).slice(0, 10), source: x.system }; }),
      })),
    quals: d.quals.map((q) => {
      const s = d.standards.find((x) => x.id === q.standard_id);
      const secure = s?.security_restricted || q.security_mirror_only;
      const v = qualView(q, new Date(`${vm.today}T12:00:00Z`)).view;
      const ok = ['qualified', 'due', 'renewed'].includes(v);
      return { code: s?.code ?? '', title: secure ? t('m17.evidence.securityQual') : pick(s, 'title'), status: secure ? t(ok ? 'm17.qual.qualified' : 'm17.qual.notQualified') : t(`m17.qual.view.${v}`), expires_on: secure ? null : q.expires_on ?? null };
    }),
    licence: lic ? { type: lic.type, status: t(`m17.licence.${licenceView(lic).view}`) } : null,
    badges: d.badges.map((b) => ({ name: pick(b.achievement, 'name'), status: t(`m17.badge.status.${badgeView(b, vm.today, d.certificates)}`), slug: b.public_slug, issued_on: b.issued_on })),
    credentials: d.badges.filter((b) => badgeView(b, vm.today, d.certificates) === 'active').map((b) => b.credential),
  };
}

export function PassportView({ d, readOnly = false }: { d: PassportData; readOnly?: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const lang = useLang();
  const eng = useEngine('match');
  const vm = usePassportModel(d);
  const model = useExportModel(d, vm);
  const [radarMode, setRadarMode] = useState<'domain' | 'competency'>('competency');
  const [target, setTarget] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [flt, setFlt] = useFilters({ q: '', area: '', basis: '', scope: '' }, true);

  const axes = useMemo(() => (radarMode === 'domain' ? radarByDomain : radarByCompetency)(vm.have, d.comps, d.roleComps as never, vm.roleId, target || null), [radarMode, vm, d, target]);
  const roleTitle = pick(vm.role, 'title');
  const targetRole = d.roles.find((r) => r.id === target);
  const areas = [...new Set(vm.lines.map((l) => l.skill.area))];
  const shown = vm.lines
    .filter((l) => !flt.area || l.skill.area === flt.area)
    .filter((l) => !flt.basis || (l.state?.basis ?? 'none') === flt.basis)
    .filter((l) => !flt.scope || l.required != null)
    .filter((l) => !flt.q || `${l.skill.code} ${pick(l.skill, 'name')}`.toLowerCase().includes(flt.q.toLowerCase()))
    .sort((a, b) => Number(b.required != null) - Number(a.required != null) || a.skill.sort - b.skill.sort);
  const verified = d.states.filter((s) => s.basis === 'verified').length;
  const opened = open ? vm.lines.find((l) => l.skill.id === open) : undefined;

  if (!vm.person) return <EmptyState title={t('m17.passport.noPerson')}>{t('m17.passport.noPersonBody')}</EmptyState>;
  return (
    <div className="space-y-6">
      {/* ── profile header */}
      <Card padded={false}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between" data-testid="m17-profile">
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent-soft text-[18px] font-bold text-eyebrow" aria-hidden>
              {vm.person.initials || '—'}
            </div>
            <div className="min-w-0">
              <div className="caps">{t('m17.passport.eyebrow')}</div>
              <div className="text-[18px] font-semibold">{pick(vm.person, 'display_name')}</div>
              <div className="text-[13.5px] text-ink-2">
                {roleTitle || '—'}
                {vm.family && <> · {pick(vm.family, 'name')}</>}
                {vm.person.unit && <> · {vm.person.unit}</>}
              </div>
              <div className="mt-1 text-[12.5px] text-ink-3">
                {vm.years != null ? t('m17.passport.years', { n: f.num(vm.years) }) : null} <span className="text-ink-3">({t('m17.passport.yearsNote')})</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 sm:max-w-[55%]">
            <div className="flex flex-wrap items-center gap-1.5" data-testid="m17-quals">
              <span className="caps me-1">{t('m17.passport.quals')}</span>
              {d.quals.length === 0 && <span className="text-[12.5px] text-ink-3">{t('m17.passport.noQuals')}</span>}
              {d.quals.map((q) => {
                const s = d.standards.find((x) => x.id === q.standard_id);
                const secure = s?.security_restricted || q.security_mirror_only;
                const v = qualView(q, new Date(`${vm.today}T12:00:00Z`));
                const ok = ['qualified', 'due', 'renewed'].includes(v.view);
                return (
                  <StatusPill key={q.id} status={secure ? (ok ? 'qualified' : 'expired') : v.view}>
                    {s?.code ?? q.standard_id} · {secure ? t(ok ? 'm17.qual.qualified' : 'm17.qual.notQualified') : t(`m17.qual.view.${v.view}`)}
                  </StatusPill>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="caps me-1">{t('m17.passport.licence')}</span>
              {d.licences.length ? (
                d.licences.map((l) => (
                  <L key={l.id} to="/my/licence" className="no-underline" data-testid="m17-licence">
                    <StatusPill status={licenceView(l).view === 'valid' ? 'valid' : licenceView(l).view === 'renewal_due' ? 'due' : licenceView(l).view}>
                      {l.type} · {t(`m17.licence.${licenceView(l).view}`)}
                    </StatusPill>
                  </L>
                ))
              ) : (
                <span className="text-[12.5px] text-ink-3">{t('m17.passport.noLicence')}</span>
              )}
              <MirrorChip />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-line p-3 lg:grid-cols-4">
          <Stat label={t('m17.passport.statSkills')} value={f.num(d.states.length)} sub={t('m17.passport.statSkillsSub', { n: f.num(d.evidence.length) })} />
          <Stat label={t('m17.passport.statVerified')} value={f.num(verified)} tone="ok" sub={t('m17.passport.statVerifiedSub')} />
          <Stat label={t('m17.passport.statCoverage')} value={vm.roleReqLines.length ? `${f.num(vm.met)}/${f.num(vm.roleReqLines.length)}` : '—'} tone={vm.met === vm.roleReqLines.length ? 'ok' : 'info'} sub={roleTitle ? t('m17.passport.statCoverageSub', { role: roleTitle }) : undefined} />
          <Stat label={t('m17.passport.statExpiring')} value={f.num(vm.expiring.length + vm.ageing.length)} tone={vm.expiring.length + vm.ageing.length ? 'sim' : 'ok'} sub={t('m17.passport.statExpiringSub')} />
        </div>
      </Card>

      {/* ── radar and strengths */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card
          title={t('m17.radar.title')}
          eyebrow={radarMode === 'domain' ? t('m17.radar.byDomain') : t('m17.radar.byCompetency')}
          actions={
            <div className="flex gap-1" role="group" aria-label={t('m17.radar.mode')}>
              {(['competency', 'domain'] as const).map((m) => (
                <button key={m} type="button" className={`btn-sm ${radarMode === m ? 'btn-primary' : 'btn-outline'}`} aria-pressed={radarMode === m} onClick={() => setRadarMode(m)} data-testid={`m17-radar-${m}`}>
                  {t(`m17.radar.${m === 'domain' ? 'byDomain' : 'byCompetency'}`)}
                </button>
              ))}
            </div>
          }
        >
          <div className="mb-2 max-w-xs">
            <SelectField label={t('m17.radar.overlay')} name="target" value={target} onChange={setTarget} placeholder={t('m17.radar.noOverlay')}
              options={d.roles.filter((r) => r.id !== vm.roleId).map((r) => ({ value: r.id, label: pick(r, 'title') }))} />
          </div>
          <SkillsRadar axes={axes} title={t('m17.radar.figTitle', { role: roleTitle || '—' })} roleLabel={roleTitle} targetLabel={pick(targetRole, 'title')} />
          {targetRole?.security_sensitive && <p className="mt-2 text-[12.5px] text-ink-3">{t('m17.radar.securityTarget')}</p>}
        </Card>
        <Card title={t('m17.strengths.title')} eyebrow={t('m17.strengths.eyebrow')} actions={<EngineBadge engine={eng} />}>
          {vm.strengths.strengths.length === 0 ? (
            <p className="text-[13px] text-ink-3">{vm.roleId ? t('m17.strengths.none') : t('m17.strengths.noRole')}</p>
          ) : (
            <ol className="space-y-3" data-testid="m17-strengths">
              {vm.strengths.strengths.map((s, i) => {
                const sk = vm.skillById.get(s.id);
                return (
                  <li key={s.id} className="rounded-card border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="caps">#{f.num(i + 1)} · {sk?.code}</div>
                        <div className="font-semibold">{pick(sk, 'name')}</div>
                      </div>
                      <LevelMeter level={s.item!.level} size="sm" />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2">
                      <BasisChip basis={s.item!.basis} />
                      {s.item!.roles.slice(0, 3).map((r) => (
                        <span key={r.id} className="chip max-w-full whitespace-normal border-line bg-sunken text-start text-ink-2">
                          {pick(d.roles.find((x) => x.id === r.id), 'title')} · {t('m17.strengths.needs', { n: f.num(r.need) })}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1"><WhyThis reasons={s.reasons} testId={`why-this-strength-${i}`} /></div>
                  </li>
                );
              })}
            </ol>
          )}
          {vm.strengths.roles.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="caps mb-1">{t('m17.strengths.closest')}</div>
              <ul className="space-y-1 text-[13px]">
                {vm.strengths.roles.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <L to={`/careers/role/${r.id}`}>{pick(d.roles.find((x) => x.id === r.id), 'title')}</L>
                    <span className="flex items-center gap-1">
                      <span className="num text-ink-2">{f.pct(r.score * 100, 0)}</span>
                      <WhyThis reasons={r.reasons} testId={`why-this-role-${r.id}`} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* ── expiring and decaying */}
      <Section title={t('m17.expiring.title')} description={t('m17.expiring.intro')}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m17-expiring">
          <Card title={t('m17.expiring.quals')} eyebrow={t('m17.expiring.qualsEyebrow')}>
            {vm.expiring.length === 0 ? (
              <p className="text-[13px] text-ink-3">{t('m17.expiring.noQuals')}</p>
            ) : (
              <ul className="space-y-2">
                {vm.expiring.map((x) => {
                  const s = d.standards.find((y) => y.id === x.standard_id);
                  return (
                    <li key={x.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                      <span className="min-w-0">
                        <span className="font-semibold">{s?.code}</span> {pick(s, 'title')}
                        <span className="block text-[12px] text-ink-3">{x.days < 0 ? t('m17.expiring.expiredOn', { date: f.date(x.expires_on) }) : t('m17.expiring.expiresOn', { date: f.date(x.expires_on), n: f.num(x.days) })}</span>
                      </span>
                      <StatusPill status={x.days < 0 ? 'expired' : 'due'}>{x.days < 0 ? t('m17.qual.view.expired') : t('m17.expiring.notice', { n: f.num(x.notice ?? 90) })}</StatusPill>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title={t('m17.expiring.skills')} eyebrow={t('m17.expiring.skillsEyebrow')}>
            {vm.ageing.length === 0 ? (
              <p className="text-[13px] text-ink-3">{t('m17.expiring.noSkills')}</p>
            ) : (
              <ul className="space-y-2">
                {vm.ageing.slice(0, 8).map((a) => {
                  const sk = vm.skillById.get(a.skill_id);
                  const course = sk ? refresherFor(sk, d.courses, vm.sec) : null;
                  return (
                    <li key={a.skill_id} className="flex items-start justify-between gap-2 text-[13.5px]">
                      <span className="min-w-0">
                        <span className="font-semibold">{sk?.code}</span> {pick(sk, 'name')}
                        <span className="block text-[12px] text-ink-3">
                          {t(`m17.expiring.state.${a.state}`, { date: f.date(a.state === 'soon' ? a.ages_on : a.since) })}
                          {course && !readOnly && (
                            <>
                              {' · '}
                              <L to={`/learn/course/${course.id}`}>{t('m17.expiring.refresh', { course: `${course.code}` })}</L>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <StatusPill status={a.state === 'soon' ? 'due_soon' : a.state === 'lapsed' ? 'lapsed' : 'stale'}>{t(`m17.expiring.chip.${a.state}`)}</StatusPill>
                        <WhyThis reasons={a.reasons} testId={`why-this-ageing-${a.skill_id}`} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </Section>

      {/* ── skills list */}
      <Section
        title={t('m17.list.title')}
        description={t('m17.list.intro')}
        actions={!readOnly && (
          <button type="button" className="btn-primary btn-sm" onClick={() => setClaiming(true)} data-testid="m17-add-claim">
            <Icon name="plus" size={14} /> {t('m17.claim.add')}
          </button>
        )}
      >
        <FilterBar
          value={flt}
          onChange={setFlt}
          search="q"
          fields={[
            { key: 'area', label: t('m17.list.area'), options: areas.map((a) => ({ value: a, label: t(`m17.area.${a}`) })) },
            { key: 'basis', label: t('m17.list.basis'), options: ['verified', 'evidenced', 'validated', 'claimed', 'none'].map((b) => ({ value: b, label: t(`common.skills.basis.${b}`) })) },
            { key: 'scope', label: t('m17.list.scope'), options: [{ value: 'role', label: t('m17.list.roleOnly') }] },
          ]}
        />
        {shown.length === 0 ? (
          <EmptyState title={t('m17.list.empty')} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-[13.5px]" data-testid="m17-skills">
              <caption className="sr-only">{t('m17.list.title')}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="caps px-3 py-2 text-start">{t('m17.list.skill')}</th>
                  <th scope="col" className="caps px-3 py-2 text-start">{t('m17.list.level')}</th>
                  <th scope="col" className="caps px-3 py-2 text-start">{t('m17.list.basis')}</th>
                  <th scope="col" className="caps hidden px-3 py-2 text-start sm:table-cell">{t('m17.dk.list.howSure')}</th>
                  <th scope="col" className="caps px-3 py-2 text-end">{t('m17.list.evidence')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => {
                  const basis = l.state?.basis ?? 'none';
                  const gap = l.required != null && (l.state?.level ?? 0) < l.required;
                  return (
                    <tr key={l.skill.id} className="border-b border-line/60 align-top" data-testid={`m17-skill-${l.skill.id}`} data-required={l.required != null ? 'yes' : 'no'}>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="num text-[11.5px] text-ink-3">{l.skill.code}</span>
                          <span className="font-medium">{pick(l.skill, 'name')}</span>
                          {l.required != null && <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m17.list.roleReq')}</span>}
                          {gap && <span className="chip border-bad-line bg-bad-bg text-bad">{t('m17.list.gap')}</span>}
                        </div>
                        <div className="text-[12px] text-ink-3">{t(`m17.area.${l.skill.area}`)}{l.comp && !l.skill.core ? ` · ${l.comp.code}` : ''}</div>
                      </td>
                      <td className="px-3 py-2">
                        {isSecuritySkill(l.skill, vm.sec) ? <span className="chip border-reserved-line bg-reserved-bg text-reserved">{t('m17.list.statusOnly')}</span> : <LevelMeter level={l.state?.level ?? 0} required={l.required} />}
                      </td>
                      <td className="px-3 py-2">
                        {l.state ? <BasisChip basis={basis} onClick={() => setOpen(l.skill.id)} testId={`m17-basis-${basis}-${l.skill.id}`} /> : <BasisChip basis="none" />}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell" data-band={l.state?.confidence_band ?? 'none'}>
                        {l.state && !isSecuritySkill(l.skill, vm.sec) ? (
                          <span className="flex flex-col items-start gap-1">
                            <BandChip band={l.state.confidence_band} low={l.state.conf_low} high={l.state.conf_high} testId={`m17-passport-band-${l.skill.id}`} />
                            <IntervalBar low={Number(l.state.conf_low ?? 0)} high={Number(l.state.conf_high ?? 0)} point={Number(l.state.confidence)} width={84} />
                          </span>
                        ) : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-3 py-2 text-end">
                        {l.state ? (
                          <span className="inline-flex items-center gap-1">
                            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(l.skill.id)} data-testid={`m17-evidence-${l.skill.id}`}>
                              {t('m17.list.evidenceN', { n: f.num(l.state.evidence_count) })}
                            </button>
                            <WhyThis reasons={skillReasons(l.state.reasons)} testId={`why-this-${l.skill.id}`} />
                          </span>
                        ) : (
                          <span className="text-[12px] text-ink-3">{t('m17.list.noEvidence')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── claims */}
      <Section title={readOnly ? t('m17.claims.titleTeam') : t('m17.claims.title')} description={t('m17.claims.intro')}>
        {d.claims.length === 0 ? (
          <EmptyState title={t('m17.claims.none')}>{!readOnly && t('m17.claims.noneBody')}</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m17-claims">
            {d.claims.map((c) => {
              const sk = vm.skillById.get(c.skill_id);
              return (
                <li key={c.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="caps">{sk?.code} · {f.date(c.created_at)}</div>
                      <div className="font-semibold">{pick(sk, 'name')}</div>
                    </div>
                    <StatusPill status={c.status === 'claimed' ? 'pending' : c.status === 'validated' ? 'approved' : c.status}>{t(`m17.claims.status.${c.status}`)}</StatusPill>
                  </div>
                  <div className="mt-1 flex items-center gap-2"><LevelMeter level={c.level} size="sm" /></div>
                  <p className="mt-1 text-[13px] text-ink-2">{c.note}</p>
                  {c.evidence_url && (
                    <a href={c.evidence_url} target="_blank" rel="noopener noreferrer nofollow" className="text-[12.5px]">
                      {t('m17.claims.link')} <Icon name="external" size={12} className="inline" />
                    </a>
                  )}
                  {c.status === 'claimed' && <p className="mt-1 text-[12px] text-ink-3">{t('m17.claims.awaiting')}</p>}
                  {c.status === 'validated' && c.decided_at && <p className="mt-1 text-[12px] text-ink-3">{t('m17.claims.validatedOn', { date: f.date(c.decided_at) })}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Callout tone="sim" title={t('m17.notAuthority.title')}>{t('m17.notAuthority.body')}</Callout>

      <EvidenceDrawer d={d} line={opened} onClose={() => setOpen(null)} readOnly={readOnly} />
      {!readOnly && <ClaimModal open={claiming} onClose={() => setClaiming(false)} d={d} vm={vm} />}
      {/* keep the export model referenced so print and JSON stay in sync with what is shown */}
      <span hidden data-export-skills={model.skills.length} />
    </div>
  );
}

function EvidenceDrawer({ d, line, onClose, readOnly = false }: { d: PassportData; line?: SkillLine; onClose: () => void; readOnly?: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const label = useEvidenceLabel(d);
  const me = useSession().identity.personId;
  if (!line) return <Drawer open={false} onClose={onClose} title="" />;
  const order = new Map((line.state?.reasons ?? []).map((r, i) => [r.evidence_id, i]));
  const rows = [...line.evidence].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  const reasonBy = new Map((line.state?.reasons ?? []).map((r) => [r.evidence_id, r]));
  return (
    <Drawer open onClose={onClose} title={`${line.skill.code} · ${pick(line.skill, 'name')}`}>
      <div className="space-y-3" data-testid="m17-evidence-drawer">
        <div className="flex flex-wrap items-center gap-2">
          <LevelMeter level={line.state?.level ?? 0} required={line.required} />
          <BasisChip basis={line.state?.basis ?? 'none'} />
          {line.state && <BandChip band={line.state.confidence_band} low={line.state.conf_low} high={line.state.conf_high} testId="m17-evidence-band" />}
          {line.state && <span className="text-[12.5px] text-ink-2">{t('common.skills.confidence', { pct: f.num(Math.round(Number(line.state.confidence) * 100)) })}</span>}
        </div>
        {line.state && (
          <section data-testid="m17-evidence-sources">
            <h3 className="mb-1.5 text-[13px] font-semibold">{t('m17.dk.drawer.record')}</h3>
            <SourceRecordView record={sourceRecord(line.state, line.evidence)} label={(r: RecordRow) => { const e = line.evidence.find((y) => y.id === r.id); return e ? label(e) : { title: r.kind, system: '' }; }} />
            {!readOnly && <L to={`/my/skills/confidence?q=${encodeURIComponent(line.skill.code)}`} className="mt-1.5 inline-block text-[12.5px]" data-testid="m17-evidence-to-confidence">{t('m17.dk.toConfidence')}</L>}
          </section>
        )}
        {!readOnly && <div className="flex justify-end"><AddGoalButton skillId={line.skill.id} person={me} /></div>}
        <p className="text-[13px] text-ink-2">{t('m17.evidence.intro')}</p>
        <ol className="space-y-2">
          {rows.map((e, i) => {
            const x = label(e);
            const r = reasonBy.get(e.id);
            return (
              <li key={e.id} className={`rounded-card border p-3 ${i === 0 ? 'border-accent/40 bg-accent-soft/40' : 'border-line'}`} data-testid="m17-evidence-row" data-kind={e.kind}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{x.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5">{x.tier && <TrustTierBadge tier={x.tier} />}<BasisChip basis={e.basis} /></span>
                </div>
                <div className="mt-1 text-[12.5px] text-ink-2">{t('m17.evidence.recorded', { system: x.system, date: f.date(e.observed_on) })}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                  <span>{t('m17.evidence.ref')}: <code>{x.ref}</code></span>
                  <span>· {t('common.skills.level', { level: f.num(e.level) })}</span>
                  {e.status === 'lapsed' && <StatusPill status="lapsed">{t('m17.evidence.lapsed')}</StatusPill>}
                  {r?.ageing && <StatusPill status="stale">{t('m17.evidence.ageing')}</StatusPill>}
                  {i === 0 && <span className="chip border-accent/30 bg-accent-soft text-eyebrow">{t('m17.evidence.strongest')}</span>}
                </div>
              </li>
            );
          })}
        </ol>
        {line.state && <WhyThis reasons={skillReasons(line.state.reasons)} testId="why-this-drawer" />}
        <p className="text-[12px] text-ink-3">{t('m17.evidence.mirrorNote')}</p>
      </div>
    </Drawer>
  );
}

function ClaimModal({ open, onClose, d, vm }: { open: boolean; onClose: () => void; d: PassportData; vm: PassportVM }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const repo = useRepo();
  const act = useAction();
  const form = useForm({ skill: '', level: '2', note: '', url: '' }, { skill: [required()], level: [required()], note: [required(), minLen(3), maxLen(NOTE_MAX)], url: [maxLen(300)] });
  const options = d.skills.filter((s) => !isSecuritySkill(s, vm.sec)).map((s) => ({ value: s.id, label: `${s.code} · ${pick(s, 'name')}` }));
  const sk = vm.skillById.get(form.values.skill);
  const comp = sk ? vm.compById.get(sk.competency_id) as Row | undefined : undefined;
  const levels = Array.from({ length: LEVEL_MAX }, (_, i) => {
    const desc = comp?.levels?.find((x: Row) => x.level === i + 1);
    return { value: String(i + 1), label: `${t('common.skills.level', { level: i + 1 })}${desc ? ` · ${lang === 'ar' ? desc.ar : desc.en}` : ''}` };
  });
  const current = sk ? d.states.find((s) => s.skill_id === sk.id) : undefined;
  const urlBad = form.values.url.trim() !== '' && !isHttpUrl(form.values.url.trim());
  return (
    <Modal open={open} onClose={onClose} title={t('m17.claim.title')} size="lg">
      <form
        className="space-y-3"
        data-testid="m17-claim-form"
        onSubmit={form.handleSubmit(async (v) => {
          if (urlBad) return;
          const r = await act(() => repo.rpc.claimSkill({ skill_id: v.skill, level: Number(v.level), note: v.note.trim(), evidence_url: v.url.trim() || null }), { success: t('m17.claim.done') });
          if (r.ok) { form.reset(); onClose(); }
        })}
      >
        <p className="text-[13px] text-ink-2">{t('m17.claim.intro')}</p>
        <SelectField label={t('m17.claim.skill')} {...form.field('skill')} options={options} placeholder={t('common.choose')} required />
        <p className="text-[12px] text-ink-3">{t('m17.claim.securityNote')}</p>
        {current && <p className="text-[12.5px] text-ink-2">{t('m17.claim.current', { level: current.level, basis: t(`common.skills.basis.${current.basis}`) })}</p>}
        <RadioGroup label={t('m17.claim.level')} name="level" value={form.values.level} onChange={(v) => form.field('level').onChange(v)} options={levels} />
        <TextArea label={t('m17.claim.note')} {...form.field('note')} hint={t('m17.claim.noteHint')} required rows={3} />
        <TextField label={t('m17.claim.url')} {...form.field('url')} hint={urlBad ? t('m17.claim.urlBad') : t('m17.claim.urlHint')} placeholder="https://" />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={form.submitting || urlBad} data-testid="m17-claim-submit">{form.submitting ? t('common.working') : t('m17.claim.submit')}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Download the passport JSON (Open Badges-style envelope). */
export function downloadPassportJson(m: PassportModel) {
  downloadText(`kafaa-skills-passport-${m.generated_on}.json`, JSON.stringify(passportJson(m), null, 2), 'application/json');
}

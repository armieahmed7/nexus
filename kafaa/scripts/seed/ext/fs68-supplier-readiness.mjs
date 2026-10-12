// FS68 / FS69 (FS wave G · E5, fsGe5, M09) seed: contractor pre-arrival shares with selective disclosure. Synthetic people only.
//   FS68 supplier future-skills readiness is computed (rpc.supplierFutureReadiness) from F33 passports, F33 contracted role profiles
//        and FS05 role profile versions; it stores nothing, so this builder only checks its invariants (an organisation under 10
//        contractors is suppressed; every organisation with contracted roles has a 2030 profile per role).
//   FS69 prearrival_shares + the FS32 record_shares rows behind them: the contractor's own share (k-contractor), shares recorded on a
//        contractor's behalf by an ENEC evaluator with the consent reference (the FS29 precedent: contractors hold no Kafa'a grant on the
//        live backend), one expired and one revoked link, and stored check summaries computed by precheckFromShare() from the shared
//        skills only. Notifications (kind prearrival) for on-behalf shares created after the seeded digests (2026-10-08).
// finalize (FINALIZE_LAST, after fs31-future-credentials which builds T.record_shares): adds the rows, because the share items come
// from the final skill states (recordItems).
import { createHash } from 'node:crypto';
import { recordItems } from '../../../src/modules/m17/learnerRecord.ts';
import { checkSummary, precheckFromShare, prearrivalProblem, sharedItems } from '../../../src/modules/m09/prearrival.ts';
import { supplierFutureReadiness } from '../../../src/modules/m09/futureReadiness.ts';

export const FINALIZE_LAST = true;
const hx = (s) => createHash('sha256').update(s).digest('hex');
const ts = (d, hh = 9) => `${d}T${String(hh).padStart(2, '0')}:00:00Z`;

// id, person, via, by, consent ref, standard, label, created, expires, mobilise, skill refs to share, checked [by, day] | null, revoked [day, reason] | null
const SHARES = [
  ['pa-kcontractor-mech', 'p-k-contractor', 'self', 'p-k-contractor', '', 'qs-mech', 'Unit 2 outage mobilisation: mechanical maintenance', '2026-10-09', '2026-12-15', '2026-11-16',
    ['sk-mp-01', 'sk-mp-01-mech', 'sk-hu-01', 'sk-hu-01-star'], ['p-k-instructor', '2026-10-10'], null],
  ['pa-calnoor01-mech', 'c-alnoor-01', 'on_behalf', 'p-training-mgr', 'ALN-CF-2026-031', 'qs-mech', 'Unit 3 maintenance window: mechanical fitter', '2026-10-10', '2026-12-31', '2026-11-30',
    ['sk-mp-01', 'sk-mp-01-mech', 'sk-hu-01', 'sk-hu-01-star', 'sk-co-01'], null, null],
  ['pa-cgulf03-ic', 'c-gulf-03', 'on_behalf', 'p-k-instructor', 'GHV-CF-2026-007', 'qs-ic', 'Valve actuator campaign: I&C support', '2026-10-09', '2026-12-10', '2026-11-09',
    ['sk-mp-02', 'sk-mp-01', 'sk-hu-01', 'sk-qa-01'], ['p-k-instructor', '2026-10-11'], null],
  ['pa-cdhafra04-rp', 'c-dhafra-04', 'on_behalf', 'p-training-mgr', 'DIS-CF-2026-112', 'qs-rp', 'Outage radiation protection support', '2026-10-11', '2026-12-20', '2026-12-01',
    ['sk-rp-01', 'sk-rp-02', 'sk-rp-02-survey', 'sk-rp-01-dose', 'sk-hu-01'], null, null],
  ['pa-cdhafra05-mech', 'c-dhafra-05', 'on_behalf', 'p-k-instructor', 'DIS-CF-2026-118', 'qs-mech', 'Pump overhaul crew: mechanical', '2026-10-09', '2026-11-28', '2026-11-20',
    ['sk-mp-01', 'sk-mp-01-mech', 'sk-hu-01-star'], ['p-training-mgr', '2026-10-10'], null],
  ['pa-cdhafra06-rp', 'c-dhafra-06', 'on_behalf', 'p-k-instructor', 'DIS-CF-2026-064', 'qs-rp', 'Mid-cycle survey support', '2026-08-20', '2026-09-30', '2026-09-28',
    ['sk-rp-01', 'sk-rp-02', 'sk-rp-02-survey'], ['p-k-instructor', '2026-08-25'], null],
  ['pa-calnoor05-qa', 'c-alnoor-05', 'on_behalf', 'p-training-mgr', 'ALN-CF-2026-022', 'qs-qa', 'Receipt inspection support', '2026-09-24', '2026-11-24', '2026-11-03',
    ['sk-qa-01', 'sk-qa-01-inspect', 'sk-qa-02'], null, ['2026-10-03', 'The contractor asked to share again without the receipt inspection skill']],
];

export default function build(T) {
  T.prearrival_shares = [];
}

export function finalize(T) {
  const people = new Map(T.people.map((p) => [p.id, p]));
  const stds = new Map(T.qual_standards.map((s) => [s.id, s]));
  const T_ = (pid, day) => ({
    today: day, person: pid, initials: people.get(pid)?.initials || '—', microcred_awards: T.microcred_awards, microcred_defs: T.microcred_defs, badges: T.badges, certificates: T.certificates,
    qual_records: T.qual_records, qual_standards: T.qual_standards, person_skills: T.person_skills, skills: T.skills, competencies: T.competencies,
  });
  T.record_shares ||= [];
  T.prearrival_shares = [];
  for (const [id, pid, via, by, consentRef, stdId, label, created, expires, mobilise, refs, checked, revoked] of SHARES) {
    const p = people.get(pid);
    if (!p || p.kind !== 'contractor') throw new Error(`fs68: ${pid} is not a contractor`);
    const items = recordItems(T_(pid, created));
    const want = refs.map((r) => `skill:${r}`);
    const input = { items: want, label, expires_on: expires, mobilise_on: mobilise, consents: { items: true, preview: true, share: true }, consent_ref: consentRef, standard_id: stdId };
    const prob = prearrivalProblem(input, items, created, via === 'on_behalf');
    if (prob !== 'ok') throw new Error(`fs68: share ${id} is not valid on ${created}: ${prob}`);
    const shareId = `rs-${id}`;
    T.record_shares.push({
      id: shareId, person_id: pid, token: hx(`kafaa-fs69-share:${id}`).slice(0, 32), label, items: want, holder_initials: p.initials || '—',
      consents: { items: true, preview: true, share: true, at: ts(created, 10), purpose: 'prearrival', on_behalf: via === 'on_behalf', recorded_by: via === 'on_behalf' ? by : null, consent_ref: consentRef || null },
      expires_on: expires, revoked_at: revoked ? ts(revoked[0], 12) : null, revoke_reason: revoked ? revoked[1] : null, views: checked ? 1 : 0, last_viewed_at: checked ? ts(checked[1], 11) : null, created_at: ts(created, 10),
    });
    let summary = null;
    if (checked) {
      const shared = sharedItems(recordItems(T_(pid, checked[1])), want);
      const r = precheckFromShare(id, pid, shared, { standard: stds.get(stdId), tasks: T.task_items, links: T.task_skill_links, skills: T.skills, comps: T.competencies, courses: T.courses });
      summary = checkSummary(r);
    }
    T.prearrival_shares.push({
      id, share_id: shareId, person_id: pid, org_id: p.org_id, standard_id: stdId, mobilise_on: mobilise, created_via: via, created_by: by, consent_ref: consentRef, note: '',
      checked_by: checked ? checked[0] : null, checked_at: checked ? ts(checked[1], 11) : null, check_summary: summary, created_at: ts(created, 10),
    });
    if (via === 'on_behalf' && created > '2026-10-08') {
      const nid = `nt-pa-${id}-created`;
      if (!T.notifications.some((n) => n.id === nid)) T.notifications.push({
        id: nid, person_id: pid, kind: 'prearrival', title_en: `An ENEC evaluator recorded your pre-arrival share for ${stds.get(stdId).code} (consent ${consentRef})`,
        title_ar: `سجّل مقيّم من مؤسسة الإمارات للطاقة النووية مشاركتك قبل الوصول لمعيار ${stds.get(stdId).code} (الموافقة ${consentRef})`, body_en: null, body_ar: null,
        link: '/partner/workforce/prearrival', severity: 'info', created_at: ts(created, 10), read_at: null,
      });
    }
  }
  T.record_shares.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.prearrival_shares.sort((a, b) => (a.id < b.id ? -1 : 1));
  T.notifications.sort((a, b) => (a.id < b.id ? -1 : 1));

  // FS68 invariants (nothing stored): suppression and profiles
  const fr = supplierFutureReadiness({ orgs: T.organisations, people: T.people, states: T.person_skills, skills: T.skills, comps: T.competencies, targets: T.contract_role_targets, profiles: T.role_profile_versions, roles: T.job_roles, courses: T.courses }, null);
  if (!fr.some((o) => o.suppressed) || !fr.some((o) => !o.suppressed)) throw new Error('fs68: expected suppressed and shown organisations');
  for (const o of fr) for (const r of o.roles) if (!r.profile_id) throw new Error(`fs68: ${o.org_id} contracted role ${r.role_id} has no published 2030 profile`);
  console.log(`fs68: ${fr.length} supplier organisations (${fr.filter((o) => o.suppressed).length} suppressed), ${fr.reduce((a, o) => a + o.roles.length, 0)} contracted roles; fs69: ${T.prearrival_shares.length} pre-arrival shares (${T.prearrival_shares.filter((s) => s.check_summary).length} checked)`);
}

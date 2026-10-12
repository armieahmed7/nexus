/**
 * (c) Arabic RTL pages, (d) mobile width, and the polished screenshot set. Supabase mode (live data). Screenshots go to
 * KAFAA_SHOTS (default test-results/shots); RTL/mobile captures go to KAFAA_QA_OUT for review by eye.
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, OUT, overflowX, pinBackend, settle, signIn, textIssues, watchErrors } from './helpers';

const SHOTS = process.env.KAFAA_SHOTS || 'test-results/shots';
mkdirSync(SHOTS, { recursive: true });
mkdirSync(join(OUT, 'rtl'), { recursive: true });
mkdirSync(join(OUT, 'mobile'), { recursive: true });

type Shot = { name: string; path: string; persona?: string; ar?: boolean; mobile?: boolean; then?: (p: Page) => Promise<void> };

async function open(page: Page, s: Shot) {
  await pinBackend(page, 'supabase');
  if (s.persona) await signIn(page, s.persona);
  if (s.mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${s.ar ? '/ar' : ''}${s.path === '/' && s.ar ? '' : s.path}`);
  await settle(page);
  if (s.then) {
    await s.then(page);
    await settle(page);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

const ask = async (p: Page) => {
  await p.locator('[data-testid="m13-input"]').fill(p.url().includes('/ar/') ? 'ما هي متطلبات مشغل المفاعل الأول؟' : 'What are the SRO entry requirements?');
  await p.locator('[data-testid="m13-send"]').click();
  await expect(p.locator('[data-testid="m13-answer"]').last()).toBeVisible();
};

// FS wave D (FS27-FS37): every new page, shared by the RTL and 390 px sets
const FSD_PAGES: Shot[] = [
  { name: 'fsd-future-gigs', path: '/opportunities/future', persona: 'nse' },
  { name: 'fsd-envelope', path: '/opportunities/envelope', persona: 'nse' },
  { name: 'fsd-team-envelopes', path: '/opportunities/envelopes', persona: 'ops-ceo' },
  { name: 'fsd-future-rotations', path: '/opportunities/rotations/future', persona: 'nse' },
  { name: 'fsd-secondments', path: '/opportunities/secondments', persona: 'fuel-pm' },
  { name: 'fsd-secondment-desk', path: '/opportunities/secondments/hr', persona: 'chco' },
  { name: 'fsd-gated-gig', path: '/opportunities/fg-ai-chem-trend-flags', persona: 'sro' },
  { name: 'fsd-recognition', path: '/recognition' },
  { name: 'fsd-recognition-nqf', path: '/recognition?tab=nqf' },
  { name: 'fsd-my-recognition', path: '/my/recognition', persona: 'sro' },
  { name: 'fsd-rpl-request', path: '/my/recognition/rpl/rpl-p-sro-01', persona: 'sro' },
  { name: 'fsd-my-credits', path: '/my/credits', persona: 'sro' },
  { name: 'fsd-rpl-queue', path: '/recognition/review', persona: 'training-mgr' },
  { name: 'fsd-rpl-review', path: '/recognition/review/rpl-p-sro-02', persona: 'training-mgr' },
  { name: 'fsd-credit-tags', path: '/admin/credit-tags', persona: 'training-mgr' },
  { name: 'fsd-my-goals', path: '/my/skills/goals', persona: 'nse' },
  { name: 'fsd-team-goals', path: '/team/skills/goals', persona: 'sro' },
  { name: 'fsd-my-record', path: '/my/skills/record', persona: 'sro' },
  { name: 'fsd-verify-record', path: '/verify/record/c8bf757ef81c15cc24d72db6e4c6be8b' },
  { name: 'fsd-future-creds', path: '/my/skills/credentials/future', persona: 'sro' },
  { name: 'fsd-credential', path: '/my/skills/credentials/c/MC-AI-ASSURER', persona: 'sro' },
  { name: 'fsd-strategic-tier', path: '/training/credentials/strategic', persona: 'training-mgr' },
  { name: 'fsd-translate', path: '/careers/translate' },
  { name: 'fsd-career-health', path: '/my/career/health', persona: 'nse' },
  { name: 'fsd-ai-register', path: '/workforce/ai-register', persona: 'chco' },
  { name: 'fsd-ai-system', path: '/workforce/ai-register/ais-doc-search', persona: 'chco' },
  { name: 'fsd-ai-pack', path: '/workforce/ai-literacy-pack', persona: 'chco' },
  { name: 'fsd-ai-register-admin', path: '/admin/ai-register', persona: 'ai-governance' },
  { name: 'fsd-drills', path: '/my/ai-fluency/drills', persona: 'qc-inspector' },
  { name: 'fsd-drill', path: '/my/ai-fluency/drills/ad-valve-lineup', persona: 'qc-inspector' },
  { name: 'fsd-training-drills', path: '/training/ai-drills', persona: 'training-mgr' },
];

const RTL: Shot[] = [
  { name: 'home', path: '/' },
  { name: 'careers', path: '/careers' },
  { name: 'careers-role', path: '/careers/roles/senior-reactor-operator' },
  { name: 'careers-plan', path: '/careers/plan?to=senior-reactor-operator' },
  { name: 'learn', path: '/learn' },
  { name: 'pathways', path: '/pathways' },
  { name: 'ask', path: '/ask', then: ask },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'my', path: '/my', persona: 'sro' },
  { name: 'licensing-validity', path: '/licensing/validity', persona: 'rao' },
  { name: 'workforce', path: '/workforce', persona: 'chco' },
  { name: 'admin', path: '/admin', persona: 'ai-governance' },
  { name: 'partner-onboarding', path: '/partner/onboarding', persona: 'alnoor-gm' },
  // wave 1 (F03-F09)
  { name: 'w1-my-skills', path: '/my/skills', persona: 'sro' },
  { name: 'w1-wallet', path: '/my/skills/wallet', persona: 'sro' },
  { name: 'w1-verify-badge', path: '/verify/badge/kb3a512774a081' },
  { name: 'w1-my-career', path: '/my/career', persona: 'qc-inspector' },
  { name: 'w1-roadmap', path: '/my/career/roadmap?role=procurement-engineer', persona: 'qc-inspector' },
  { name: 'w1-my-coach', path: '/my/coach', persona: 'qc-inspector' },
  { name: 'w1-opportunities', path: '/opportunities', persona: 'qc-inspector' },
  { name: 'w1-opportunity', path: '/opportunities/opp-u3-outage-valve-walkdowns', persona: 'qc-inspector' },
  { name: 'w1-my-future', path: '/my/future', persona: 'qc-inspector' },
  { name: 'w1-future-interest', path: '/workforce/future/interest', persona: 'chco' },
  // wave 2 (F10-F17)
  { name: 'w2-checkins', path: '/my/skills/checkins', persona: 'nse' },
  { name: 'w2-validate', path: '/team/skills/validate', persona: 'cpo' },
  { name: 'w2-team-skills', path: '/team/skills', persona: 'sro' },
  { name: 'w2-conversations', path: '/my/career/conversations', persona: 'qc-inspector' },
  { name: 'w2-team-conversations', path: '/team/conversations', persona: 'head-sq' },
  { name: 'w2-mentoring', path: '/my/mentoring', persona: 'qc-inspector' },
  { name: 'w2-mentoring-agreement', path: '/my/mentoring/ma-mr-f13-001', persona: 'qc-inspector' },
  { name: 'w2-refresh', path: '/my/coach/refresh', persona: 'nse' },
  { name: 'w2-rotations', path: '/opportunities/rotations', persona: 'qc-inspector' },
  { name: 'w2-rotation-board', path: '/opportunities/rotations/board', persona: 'chco' },
  { name: 'w2-leadership', path: '/leadership', persona: 'sro' },
  { name: 'w2-leadership-360', path: '/leadership/360', persona: 'sro' },
  { name: 'w2-communities', path: '/communities', persona: 'qc-inspector' },
  { name: 'w2-experts', path: '/communities/experts', persona: 'qc-inspector' },
  // wave 3 (F18-F24)
  { name: 'w3-talent-review', path: '/talent/review', persona: 'chco' },
  { name: 'w3-cycle', path: '/talent/review/trc-2026h2-ops', persona: 'ops-ceo' },
  { name: 'w3-calibration', path: '/talent/review/trc-2026h2-mne/calibration', persona: 'chco' },
  { name: 'w3-succession', path: '/talent/succession', persona: 'chco' },
  { name: 'w3-slate', path: '/talent/succession/ss-shift-supervisor-2026h2', persona: 'chco' },
  { name: 'w3-my-priorities', path: '/my/development-priorities', persona: 'qc-inspector' },
  { name: 'w3-klra', path: '/knowledge/klra', persona: 'training-mgr' },
  { name: 'w3-klra-position', path: '/knowledge/klra/pos-w-sro-02', persona: 'training-mgr' },
  { name: 'w3-knowledge', path: '/knowledge', persona: 'qc-inspector' },
  { name: 'w3-capture', path: '/knowledge/capture', persona: 'training-mgr' },
  { name: 'w3-handover', path: '/workforce/handover', persona: 'chco' },
  { name: 'w3-reserve', path: '/opportunities/reserve', persona: 'qc-inspector' },
  { name: 'w3-reserve-me', path: '/opportunities/reserve/me', persona: 'sme-reviewer' },
  { name: 'w3-reserve-desk', path: '/opportunities/reserve/hr', persona: 'chco' },
  { name: 'w3-ai-transparency', path: '/admin/ai-transparency', persona: 'ai-governance' },
  { name: 'w3-settings-reco', path: '/my/settings', persona: 'nse' },
  // wave 4 (F25-F31)
  { name: 'w4-effectiveness', path: '/training/effectiveness', persona: 'training-mgr' },
  { name: 'w4-effectiveness-course', path: '/training/effectiveness/c-hu', persona: 'training-mgr' },
  { name: 'w4-observations', path: '/training/observations', persona: 'sro' },
  { name: 'w4-my-feedback', path: '/my/learning/feedback', persona: 'sro' },
  { name: 'w4-needs', path: '/training/needs', persona: 'training-mgr' },
  { name: 'w4-sat', path: '/training/sat', persona: 'training-mgr' },
  { name: 'w4-sat-role', path: '/training/sat/roles/local-operator', persona: 'training-mgr' },
  { name: 'w4-sat-task', path: '/training/sat/tasks/jt-qs-ro-t1', persona: 'training-mgr' },
  { name: 'w4-sat-changes', path: '/training/sat/changes', persona: 'training-mgr' },
  { name: 'w4-accreditation', path: '/training/accreditation', persona: 'training-mgr' },
  { name: 'w4-self-eval', path: '/training/accreditation/ase-coit-2026-H2', persona: 'training-mgr' },
  { name: 'w4-scenarios', path: '/training/simulator/scenarios', persona: 'training-mgr' },
  { name: 'w4-scenario', path: '/training/simulator/scenarios/scn-012', persona: 'training-mgr' },
  { name: 'w4-my-simulator', path: '/my/simulator', persona: 'sro' },
  { name: 'w4-my-learning-record', path: '/my/learning-record', persona: 'nse' },
  { name: 'w4-lrs', path: '/training/lrs', persona: 'training-mgr' },
  { name: 'w4-lrs-adapters', path: '/training/lrs/adapters', persona: 'ai-governance' },
  { name: 'w4-instructors', path: '/training/instructors', persona: 'training-mgr' },
  { name: 'w4-instructor-track', path: '/training/instructors/it-w-rp-02', persona: 'training-mgr' },
  { name: 'w4-my-instructor', path: '/my/instructor', persona: 'sme-reviewer' },
  { name: 'w4-team-instructors', path: '/team/instructors', persona: 'chem-sup' },
  // wave 5 (F32-F38): every new route
  { name: 'w5-credentials', path: '/my/skills/credentials', persona: 'qc-inspector' },
  { name: 'w5-frameworks-mc', path: '/admin/frameworks?tab=microcredentials', persona: 'training-mgr' },
  { name: 'w5-verify-mc', path: '/verify/badge/mcbee68fc86569' },
  { name: 'w5-my-ojt', path: '/my/ojt', persona: 'qc-inspector' },
  { name: 'w5-team-ojt', path: '/team/ojt', persona: 'head-sq' },
  { name: 'w5-passport', path: '/partner/workforce/passport', persona: 'alnoor-gm' },
  { name: 'w5-passport-person', path: '/partner/workforce/passport/c-alnoor-02', persona: 'alnoor-gm' },
  { name: 'w5-precheck', path: '/partner/workforce/precheck?person=c-alnoor-06&standard=qs-elec', persona: 'alnoor-gm' },
  { name: 'w5-eq-passport', path: '/training/equivalency/passport/c-alnoor-02', persona: 'training-mgr' },
  { name: 'w5-contract-roles', path: '/admin/suppliers/contract-roles', persona: 'ai-governance' },
  { name: 'w5-journey', path: '/pathways/journey' },
  { name: 'w5-journey-parents', path: '/pathways/journey/parents?stage=finishing_school&route=dnt&families=operations' },
  { name: 'w5-workforce-journeys', path: '/workforce/journeys', persona: 'chco' },
  { name: 'w5-skills-outlook', path: '/workforce/skills-outlook', persona: 'chco' },
  { name: 'w5-admin-digest', path: '/admin/digest', persona: 'ai-governance' },
  { name: 'w5-my-digest', path: '/my', persona: 'sq-lead' },
  { name: 'w5-ask-career', path: '/ask?mode=career', persona: 'nse' },
  // FS wave A (FS01-FS06): every new page and tab
  { name: 'fsa-my-confidence', path: '/my/skills/confidence', persona: 'nse' },
  { name: 'fsa-admin-confidence', path: '/admin/skills-confidence', persona: 'ai-governance' },
  { name: 'fsa-workforce-future', path: '/workforce/future', persona: 'chco' },
  { name: 'fsa-keyspace', path: '/workforce/future/keyspace', persona: 'chco' },
  { name: 'fsa-horizons', path: '/careers/horizons' },
  { name: 'fsa-role-horizons', path: '/careers/roles/reactor-operator?tab=horizons' },
  { name: 'fsa-concept-role', path: '/careers/roles/fr-remote-ops?tab=horizons' },
  { name: 'fsa-profile-edit', path: '/careers/roles/maintenance-technician-engineer/profile?h=2035', persona: 'training-mgr' },
  { name: 'fsa-sat-future', path: '/training/sat/future', persona: 'training-mgr' },
  { name: 'fsa-sat-task', path: '/training/sat/tasks/jt-qs-ro-t4', persona: 'training-mgr' },
  { name: 'fsa-admin-skills', path: '/admin/frameworks?tab=skills', persona: 'ai-governance' },
  { name: 'fsa-admin-benchmarks', path: '/admin/frameworks?tab=benchmarks', persona: 'ai-governance' },
  // FS wave B (FS07-FS16): every new page, plus the pages that gained wave-B sections
  { name: 'fsb-skills', path: '/skills' },
  { name: 'fsb-skill', path: '/skills/sk-fs-ai-verify' },
  { name: 'fsb-skill-crosswalk', path: '/skills/sk-fs-tr-analytical?tab=crosswalk' },
  { name: 'fsb-frameworks', path: '/skills/frameworks' },
  { name: 'fsb-alignments', path: '/admin/skills/alignments', persona: 'training-mgr' },
  { name: 'fsb-ladder', path: '/learn/ai-fluency' },
  { name: 'fsb-my-ai', path: '/my/ai-fluency', persona: 'nse' },
  { name: 'fsb-fitness', path: '/my/ai-fluency/check', persona: 'sro' },
  { name: 'fsb-workforce-ai', path: '/workforce/ai-fluency', persona: 'chco' },
  { name: 'fsb-items', path: '/training/ai-fitness/items', persona: 'training-mgr' },
  { name: 'fsb-role-2030', path: '/my/role-2030?role=reactor-operator', persona: 'sro' },
  { name: 'fsb-tasks', path: '/my/role-2030/tasks?role=reactor-operator', persona: 'sro' },
  { name: 'fsb-public-transformation', path: '/careers/roles/reactor-operator/transformation' },
  { name: 'fsb-workforce-transformation', path: '/workforce/transformation', persona: 'chco' },
  { name: 'fsb-transformation-edit', path: '/workforce/transformation/chemistry-technician', persona: 'training-mgr' },
  { name: 'fsb-my-future', path: '/my/future', persona: 'nse' },
  { name: 'fsb-future-tech', path: '/my/future/bwr', persona: 'nse' },
  { name: 'fsb-future-interest', path: '/workforce/future/interest', persona: 'chco' },
  { name: 'fsb-my-career', path: '/my/career', persona: 'sro' },
  { name: 'fsb-roadmap-concept', path: '/my/career/roadmap?role=fr-bwr-operator', persona: 'sro' },
  { name: 'fsb-team-career', path: '/team/career', persona: 'sro' },
  { name: 'fsb-outlook-criteria', path: '/careers/outlook-criteria' },
  { name: 'fsb-careers', path: '/careers' },
  { name: 'fsb-role', path: '/careers/roles/reactor-operator?tab=horizons' },
  // FS wave C (FS17-FS26): every new page
  { name: 'fsc-pathways', path: '/learn/pathways', persona: 'nse' },
  { name: 'fsc-pathway', path: '/learn/pathways/pw-ai-verify-l2', persona: 'nse' },
  { name: 'fsc-my-pathways', path: '/my/pathways', persona: 'sro' },
  { name: 'fsc-external', path: '/learn/external', persona: 'nse' },
  { name: 'fsc-training-pathways', path: '/training/pathways', persona: 'training-mgr' },
  { name: 'fsc-training-external', path: '/training/external', persona: 'training-mgr' },
  { name: 'fsc-course-pack', path: '/learn/future-skills' },
  { name: 'fsc-academies', path: '/learn/academies' },
  { name: 'fsc-academy', path: '/learn/academies/ac-ai' },
  { name: 'fsc-my-academies', path: '/my/academies', persona: 'buyer' },
  { name: 'fsc-training-pack', path: '/training/future-skills', persona: 'training-mgr' },
  { name: 'fsc-training-academies', path: '/training/academies', persona: 'training-mgr' },
  { name: 'fsc-adaptive', path: '/my/assessments/adaptive', persona: 'nse' },
  { name: 'fsc-adaptive-take', path: '/my/assessments/adaptive/ab-ai-literacy', persona: 'nse' },
  { name: 'fsc-tasks', path: '/my/assessments/tasks', persona: 'nse' },
  { name: 'fsc-task', path: '/my/assessments/tasks/pt-feedwater-drift', persona: 'nse' },
  { name: 'fsc-training-adaptive', path: '/training/adaptive', persona: 'training-mgr' },
  { name: 'fsc-training-perf', path: '/training/perf-tasks', persona: 'training-mgr' },
  { name: 'fsc-integrity', path: '/training/integrity', persona: 'presenter' },
  { name: 'fsc-levels', path: '/competencies/levels' },
  { name: 'fsc-descriptors', path: '/competencies/descriptors' },
  { name: 'fsc-descriptor', path: '/competencies/descriptors/sk-fs-ai-verify' },
  { name: 'fsc-scale', path: '/competencies/scale' },
  { name: 'fsc-my-levels', path: '/my/levels', persona: 'sro' },
  { name: 'fsc-admin-descriptors', path: '/admin/descriptors', persona: 'training-mgr' },
  { name: 'fsc-admin-authority', path: '/admin/authority', persona: 'chco' },
  { name: 'fsc-core-skills', path: '/learn/core-skills' },
  { name: 'fsc-core-skill', path: '/learn/core-skills/cs-systems', persona: 'nse' },
  { name: 'fsc-my-core', path: '/my/core-skills', persona: 'nse' },
  { name: 'fsc-practice', path: '/my/core-skills/practice', persona: 'nse' },
  { name: 'fsc-workforce-core', path: '/workforce/core-skills', persona: 'chco' },
  { name: 'fsc-sjt-items', path: '/training/sjt/items', persona: 'training-mgr' },
  { name: 'fsc-skill-indicators', path: '/skills/sk-fs-ai-verify' },
  ...FSD_PAGES,
];
for (const s of RTL) {
  test(`rtl ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await open(page, { ...s, ar: true });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    expect(await overflowX(page), 'no horizontal scroll').toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    // Most visible text is Arabic (Latin allowed for codes, names and numbers).
    const text = await page.locator('main').innerText();
    const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
    const lat = (text.match(/[A-Za-z]/g) ?? []).length;
    expect(ar, `${s.name}: Arabic letters ${ar} vs Latin ${lat}`).toBeGreaterThan(lat);
    await page.screenshot({ path: join(OUT, 'rtl', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
}

const MOBILE: Shot[] = [
  { name: 'home', path: '/' },
  { name: 'careers', path: '/careers' },
  { name: 'careers-role', path: '/careers/roles/reactor-operator' },
  { name: 'ask', path: '/ask', then: ask },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'my', path: '/my', persona: 'nse' },
  { name: 'learn-course', path: '/learn/course/c-hu', persona: 'nse' },
  { name: 'partner-onboarding', path: '/partner/onboarding', persona: 'alnoor-gm' },
  { name: 'licensing-validity', path: '/licensing/validity', persona: 'rao' },
  // wave 1 (F03-F09)
  { name: 'w1-my-skills', path: '/my/skills', persona: 'sro' },
  { name: 'w1-wallet', path: '/my/skills/wallet', persona: 'sro' },
  { name: 'w1-verify-badge', path: '/verify/badge/kb3a512774a081' },
  { name: 'w1-my-career', path: '/my/career', persona: 'qc-inspector' },
  { name: 'w1-roadmap', path: '/my/career/roadmap?role=procurement-engineer', persona: 'qc-inspector' },
  { name: 'w1-my-coach', path: '/my/coach', persona: 'qc-inspector' },
  { name: 'w1-opportunities', path: '/opportunities', persona: 'qc-inspector' },
  { name: 'w1-my-future', path: '/my/future', persona: 'qc-inspector' },
  // wave 2 (F10-F17)
  { name: 'w2-checkins', path: '/my/skills/checkins', persona: 'nse' },
  { name: 'w2-validate', path: '/team/skills/validate', persona: 'cpo' },
  { name: 'w2-team-skills', path: '/team/skills', persona: 'sro' },
  { name: 'w2-conversations', path: '/my/career/conversations', persona: 'qc-inspector' },
  { name: 'w2-mentoring', path: '/my/mentoring', persona: 'qc-inspector' },
  { name: 'w2-refresh', path: '/my/coach/refresh', persona: 'nse' },
  { name: 'w2-rotations-my', path: '/opportunities/rotations/my', persona: 'qc-inspector' },
  { name: 'w2-leadership', path: '/leadership', persona: 'sro' },
  { name: 'w2-communities', path: '/communities/cop-eng', persona: 'qc-inspector' },
  { name: 'w2-sessions', path: '/communities/sessions', persona: 'qc-inspector' },
  { name: 'w2-mentoring-programme', path: '/my/mentoring/programme', persona: 'training-mgr' },
  { name: 'w2-refresher-insights', path: '/training/refreshers', persona: 'training-mgr' },
  { name: 'w2-validate-ops', path: '/team/skills/validate', persona: 'ops-ceo' },
  // wave 3 (F18-F24)
  { name: 'w3-talent-review', path: '/talent/review', persona: 'chco' },
  { name: 'w3-cycle', path: '/talent/review/trc-2026h2-ops', persona: 'ops-ceo' },
  { name: 'w3-calibration', path: '/talent/review/trc-2026h2-mne/calibration', persona: 'chco' },
  { name: 'w3-insights', path: '/talent/review/insights', persona: 'chco' },
  { name: 'w3-succession', path: '/talent/succession', persona: 'chco' },
  { name: 'w3-slate', path: '/talent/succession/ss-shift-supervisor-2026h2', persona: 'chco' },
  { name: 'w3-my-priorities', path: '/my/development-priorities', persona: 'qc-inspector' },
  { name: 'w3-klra', path: '/knowledge/klra', persona: 'training-mgr' },
  { name: 'w3-klra-position', path: '/knowledge/klra/pos-w-sro-02', persona: 'training-mgr' },
  { name: 'w3-knowledge', path: '/knowledge', persona: 'qc-inspector' },
  { name: 'w3-asset', path: '/knowledge/assets/kas-001', persona: 'qc-inspector' },
  { name: 'w3-capture', path: '/knowledge/capture', persona: 'training-mgr' },
  { name: 'w3-session', path: '/knowledge/capture/cs-001', persona: 'training-mgr' },
  { name: 'w3-review', path: '/knowledge/review', persona: 'training-mgr' },
  { name: 'w3-handover', path: '/workforce/handover', persona: 'chco' },
  { name: 'w3-reserve', path: '/opportunities/reserve', persona: 'qc-inspector' },
  { name: 'w3-reserve-me', path: '/opportunities/reserve/me', persona: 'sme-reviewer' },
  { name: 'w3-reserve-request', path: '/opportunities/reserve/request', persona: 'outage-manager' },
  { name: 'w3-reserve-desk', path: '/opportunities/reserve/hr', persona: 'chco' },
  { name: 'w3-ai-transparency', path: '/admin/ai-transparency', persona: 'ai-governance' },
  { name: 'w3-settings-reco', path: '/my/settings', persona: 'nse' },
  // wave 4 (F25-F31): every new route
  { name: 'w4-effectiveness', path: '/training/effectiveness', persona: 'training-mgr' },
  { name: 'w4-effectiveness-course', path: '/training/effectiveness/c-hu', persona: 'training-mgr' },
  { name: 'w4-observations', path: '/training/observations', persona: 'sro' },
  { name: 'w4-my-feedback', path: '/my/learning/feedback', persona: 'sro' },
  { name: 'w4-needs', path: '/training/needs', persona: 'training-mgr' },
  { name: 'w4-sat', path: '/training/sat', persona: 'training-mgr' },
  { name: 'w4-sat-role', path: '/training/sat/roles/local-operator', persona: 'training-mgr' },
  { name: 'w4-sat-task', path: '/training/sat/tasks/jt-qs-ro-t1', persona: 'training-mgr' },
  { name: 'w4-sat-changes', path: '/training/sat/changes', persona: 'training-mgr' },
  { name: 'w4-sat-report', path: '/training/sat/roles/local-operator/report', persona: 'training-mgr' },
  { name: 'w4-sat-survey', path: '/training/sat/survey', persona: 'sme-reviewer' },
  { name: 'w4-accreditation', path: '/training/accreditation', persona: 'training-mgr' },
  { name: 'w4-self-eval', path: '/training/accreditation/ase-coit-2026-H2', persona: 'training-mgr' },
  { name: 'w4-accr-report', path: '/training/accreditation/ase-coit-2026-H1/report', persona: 'presenter' },
  { name: 'w4-scenarios', path: '/training/simulator/scenarios', persona: 'training-mgr' },
  { name: 'w4-scenario', path: '/training/simulator/scenarios/scn-012', persona: 'training-mgr' },
  { name: 'w4-my-simulator', path: '/my/simulator', persona: 'sro' },
  { name: 'w4-my-learning-record', path: '/my/learning-record', persona: 'nse' },
  { name: 'w4-lrs', path: '/training/lrs', persona: 'training-mgr' },
  { name: 'w4-lrs-person', path: '/training/lrs/people/p-sro', persona: 'sro' },
  { name: 'w4-lrs-adapters', path: '/training/lrs/adapters', persona: 'ai-governance' },
  { name: 'w4-lrs-console', path: '/training/lrs/console', persona: 'ai-governance' },
  { name: 'w4-instructors', path: '/training/instructors', persona: 'training-mgr' },
  { name: 'w4-instructor-track', path: '/training/instructors/it-w-rp-02', persona: 'training-mgr' },
  { name: 'w4-my-instructor', path: '/my/instructor', persona: 'sme-reviewer' },
  { name: 'w4-team-instructors', path: '/team/instructors', persona: 'chem-sup' },
  // wave 5 (F32-F38): every new route
  { name: 'w5-credentials', path: '/my/skills/credentials', persona: 'qc-inspector' },
  { name: 'w5-frameworks-mc', path: '/admin/frameworks?tab=microcredentials', persona: 'training-mgr' },
  { name: 'w5-verify-mc', path: '/verify/badge/mcbee68fc86569' },
  { name: 'w5-my-ojt', path: '/my/ojt', persona: 'qc-inspector' },
  { name: 'w5-team-ojt', path: '/team/ojt', persona: 'head-sq' },
  { name: 'w5-passport', path: '/partner/workforce/passport', persona: 'alnoor-gm' },
  { name: 'w5-passport-person', path: '/partner/workforce/passport/c-alnoor-02', persona: 'alnoor-gm' },
  { name: 'w5-precheck', path: '/partner/workforce/precheck?person=c-alnoor-06&standard=qs-elec', persona: 'alnoor-gm' },
  { name: 'w5-eq-passport', path: '/training/equivalency/passport/c-alnoor-02', persona: 'training-mgr' },
  { name: 'w5-contract-roles', path: '/admin/suppliers/contract-roles', persona: 'ai-governance' },
  { name: 'w5-journey', path: '/pathways/journey' },
  { name: 'w5-journey-parents', path: '/pathways/journey/parents?stage=finishing_school&route=dnt&families=operations' },
  { name: 'w5-workforce-journeys', path: '/workforce/journeys', persona: 'chco' },
  { name: 'w5-skills-outlook', path: '/workforce/skills-outlook', persona: 'chco' },
  { name: 'w5-admin-digest', path: '/admin/digest', persona: 'ai-governance' },
  { name: 'w5-my-digest', path: '/my', persona: 'sq-lead' },
  { name: 'w5-ask-career', path: '/ask?mode=career', persona: 'nse' },
  // FS wave A (FS01-FS06): every new page and tab
  { name: 'fsa-my-confidence', path: '/my/skills/confidence', persona: 'nse' },
  { name: 'fsa-admin-confidence', path: '/admin/skills-confidence', persona: 'ai-governance' },
  { name: 'fsa-workforce-future', path: '/workforce/future', persona: 'chco' },
  { name: 'fsa-keyspace', path: '/workforce/future/keyspace', persona: 'chco' },
  { name: 'fsa-horizons', path: '/careers/horizons' },
  { name: 'fsa-role-horizons', path: '/careers/roles/reactor-operator?tab=horizons' },
  { name: 'fsa-concept-role', path: '/careers/roles/fr-remote-ops?tab=horizons' },
  { name: 'fsa-profile-edit', path: '/careers/roles/maintenance-technician-engineer/profile?h=2035', persona: 'training-mgr' },
  { name: 'fsa-sat-future', path: '/training/sat/future', persona: 'training-mgr' },
  { name: 'fsa-sat-task', path: '/training/sat/tasks/jt-qs-ro-t4', persona: 'training-mgr' },
  { name: 'fsa-admin-skills', path: '/admin/frameworks?tab=skills', persona: 'ai-governance' },
  { name: 'fsa-admin-benchmarks', path: '/admin/frameworks?tab=benchmarks', persona: 'ai-governance' },
  // FS wave B (FS07-FS16): every new page, plus the pages that gained wave-B sections
  { name: 'fsb-skills', path: '/skills' },
  { name: 'fsb-skill', path: '/skills/sk-fs-ai-verify' },
  { name: 'fsb-skill-crosswalk', path: '/skills/sk-fs-tr-analytical?tab=crosswalk' },
  { name: 'fsb-frameworks', path: '/skills/frameworks' },
  { name: 'fsb-alignments', path: '/admin/skills/alignments', persona: 'training-mgr' },
  { name: 'fsb-ladder', path: '/learn/ai-fluency' },
  { name: 'fsb-my-ai', path: '/my/ai-fluency', persona: 'nse' },
  { name: 'fsb-fitness', path: '/my/ai-fluency/check', persona: 'sro' },
  { name: 'fsb-workforce-ai', path: '/workforce/ai-fluency', persona: 'chco' },
  { name: 'fsb-items', path: '/training/ai-fitness/items', persona: 'training-mgr' },
  { name: 'fsb-role-2030', path: '/my/role-2030?role=reactor-operator', persona: 'sro' },
  { name: 'fsb-tasks', path: '/my/role-2030/tasks?role=reactor-operator', persona: 'sro' },
  { name: 'fsb-public-transformation', path: '/careers/roles/reactor-operator/transformation' },
  { name: 'fsb-workforce-transformation', path: '/workforce/transformation', persona: 'chco' },
  { name: 'fsb-transformation-edit', path: '/workforce/transformation/chemistry-technician', persona: 'training-mgr' },
  { name: 'fsb-my-future', path: '/my/future', persona: 'nse' },
  { name: 'fsb-future-tech', path: '/my/future/bwr', persona: 'nse' },
  { name: 'fsb-future-interest', path: '/workforce/future/interest', persona: 'chco' },
  { name: 'fsb-my-career', path: '/my/career', persona: 'sro' },
  { name: 'fsb-roadmap-concept', path: '/my/career/roadmap?role=fr-bwr-operator', persona: 'sro' },
  { name: 'fsb-team-career', path: '/team/career', persona: 'sro' },
  { name: 'fsb-outlook-criteria', path: '/careers/outlook-criteria' },
  { name: 'fsb-careers', path: '/careers' },
  { name: 'fsb-role', path: '/careers/roles/reactor-operator?tab=horizons' },
  // FS wave C (FS17-FS26): every new page
  { name: 'fsc-pathways', path: '/learn/pathways', persona: 'nse' },
  { name: 'fsc-pathway', path: '/learn/pathways/pw-ai-verify-l2', persona: 'nse' },
  { name: 'fsc-my-pathways', path: '/my/pathways', persona: 'sro' },
  { name: 'fsc-external', path: '/learn/external', persona: 'nse' },
  { name: 'fsc-training-pathways', path: '/training/pathways', persona: 'training-mgr' },
  { name: 'fsc-training-external', path: '/training/external', persona: 'training-mgr' },
  { name: 'fsc-course-pack', path: '/learn/future-skills' },
  { name: 'fsc-academies', path: '/learn/academies' },
  { name: 'fsc-academy', path: '/learn/academies/ac-ai' },
  { name: 'fsc-my-academies', path: '/my/academies', persona: 'buyer' },
  { name: 'fsc-training-pack', path: '/training/future-skills', persona: 'training-mgr' },
  { name: 'fsc-training-academies', path: '/training/academies', persona: 'training-mgr' },
  { name: 'fsc-adaptive', path: '/my/assessments/adaptive', persona: 'nse' },
  { name: 'fsc-adaptive-take', path: '/my/assessments/adaptive/ab-ai-literacy', persona: 'nse' },
  { name: 'fsc-tasks', path: '/my/assessments/tasks', persona: 'nse' },
  { name: 'fsc-task', path: '/my/assessments/tasks/pt-feedwater-drift', persona: 'nse' },
  { name: 'fsc-training-adaptive', path: '/training/adaptive', persona: 'training-mgr' },
  { name: 'fsc-training-perf', path: '/training/perf-tasks', persona: 'training-mgr' },
  { name: 'fsc-integrity', path: '/training/integrity', persona: 'presenter' },
  { name: 'fsc-levels', path: '/competencies/levels' },
  { name: 'fsc-descriptors', path: '/competencies/descriptors' },
  { name: 'fsc-descriptor', path: '/competencies/descriptors/sk-fs-ai-verify' },
  { name: 'fsc-scale', path: '/competencies/scale' },
  { name: 'fsc-my-levels', path: '/my/levels', persona: 'sro' },
  { name: 'fsc-admin-descriptors', path: '/admin/descriptors', persona: 'training-mgr' },
  { name: 'fsc-admin-authority', path: '/admin/authority', persona: 'chco' },
  { name: 'fsc-core-skills', path: '/learn/core-skills' },
  { name: 'fsc-core-skill', path: '/learn/core-skills/cs-systems', persona: 'nse' },
  { name: 'fsc-my-core', path: '/my/core-skills', persona: 'nse' },
  { name: 'fsc-practice', path: '/my/core-skills/practice', persona: 'nse' },
  { name: 'fsc-workforce-core', path: '/workforce/core-skills', persona: 'chco' },
  { name: 'fsc-sjt-items', path: '/training/sjt/items', persona: 'training-mgr' },
  { name: 'fsc-skill-indicators', path: '/skills/sk-fs-ai-verify' },
  ...FSD_PAGES,
];
for (const s of MOBILE) {
  test(`mobile ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await open(page, { ...s, mobile: true });
    expect(await overflowX(page), `${s.name}: page scrolls sideways at 390 px`).toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    await page.screenshot({ path: join(OUT, 'mobile', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
}

const SET: Shot[] = [
  { name: '01-home-en', path: '/' },
  { name: '02-careers-role-en', path: '/careers/roles/senior-reactor-operator' },
  { name: '03-careers-plan-en', path: '/careers/plan?to=senior-reactor-operator' },
  { name: '04-my-dashboard-sro-en', path: '/my', persona: 'sro' },
  { name: '05-team-quals-sro-en', path: '/team/quals', persona: 'sro' },
  { name: '06-licensing-validity-en', path: '/licensing/validity', persona: 'rao' },
  { name: '07-training-schedule-en', path: '/training/schedule', persona: 'training-mgr' },
  { name: '08-workforce-en', path: '/workforce', persona: 'chco' },
  { name: '09-ask-dalil-en', path: '/ask', then: ask },
  { name: '10-partner-onboarding-en', path: '/partner/onboarding', persona: 'gulfhydro-qa' },
  { name: '11-admin-en', path: '/admin', persona: 'ai-governance' },
  { name: '12-home-ar', path: '/', ar: true },
  { name: '13-careers-role-ar', path: '/careers/roles/senior-reactor-operator', ar: true },
  { name: '14-my-dashboard-ar', path: '/my', persona: 'sro', ar: true },
  { name: '15-home-mobile', path: '/', mobile: true },
  { name: '16-ask-dalil-mobile', path: '/ask', mobile: true, then: ask },
];
for (const s of SET) {
  test(`shot ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS, `${s.name}.png`), fullPage: false });
  });
}

// Wave 1 feature set (F03-F09): saved to KAFAA_SHOTS_W1.
const SHOTS_W1 = process.env.KAFAA_SHOTS_W1 || 'test-results/shots_w1';
mkdirSync(SHOTS_W1, { recursive: true });
const SET_W1: Shot[] = [
  { name: '01-skills-passport-en', path: '/my/skills', persona: 'sro' },
  { name: '02-credential-wallet-en', path: '/my/skills/wallet', persona: 'sro' },
  { name: '03-verify-badge-public-en', path: '/verify/badge/kb3a512774a081' },
  { name: '04-career-navigator-en', path: '/my/career', persona: 'qc-inspector' },
  { name: '05-career-roadmap-whatif-en', path: '/my/career/roadmap?role=procurement-engineer', persona: 'qc-inspector', then: async (p) => { await p.locator('input[type="range"]').first().fill('2'); } },
  { name: '06-learning-coach-en', path: '/my/coach', persona: 'qc-inspector', then: async (p) => { await p.locator('[data-testid="m19-card"] [data-testid="why-this"]').nth(1).click(); } },
  { name: '07-opportunity-marketplace-en', path: '/opportunities', persona: 'qc-inspector' },
  { name: '08-future-me-en', path: '/my/future', persona: 'qc-inspector' },
  { name: '09-skills-passport-ar', path: '/my/skills', persona: 'sro', ar: true },
  { name: '10-future-me-mobile', path: '/my/future', persona: 'qc-inspector', mobile: true },
];
for (const s of SET_W1) {
  test(`shot w1 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W1, `${s.name}.png`), fullPage: false });
  });
}

// Wave 2 feature set (F10-F17): saved to KAFAA_SHOTS_W2.
const SHOTS_W2 = process.env.KAFAA_SHOTS_W2 || 'test-results/shots_w2';
mkdirSync(SHOTS_W2, { recursive: true });
const SET_W2: Shot[] = [
  { name: '01-skill-checkins-en', path: '/my/skills/checkins', persona: 'nse' },
  { name: '02-team-heatmap-en', path: '/team/skills', persona: 'sro' },
  { name: '03-career-conversation-en', path: '/team/conversations?person=p-qc-inspector', persona: 'head-sq' },
  { name: '04-mentoring-matches-en', path: '/my/mentoring', persona: 'qc-inspector' },
  { name: '05-knowledge-refresher-en', path: '/my/coach/refresh', persona: 'nse' },
  { name: '06-rotations-en', path: '/opportunities/rotations', persona: 'qc-inspector' },
  { name: '07-leadership-academy-en', path: '/leadership', persona: 'sro' },
  { name: '08-communities-experts-en', path: '/communities/experts', persona: 'qc-inspector' },
  { name: '09-leadership-academy-ar', path: '/leadership', persona: 'sro', ar: true },
  { name: '10-team-heatmap-mobile', path: '/team/skills', persona: 'sro', mobile: true },
];
for (const s of SET_W2) {
  test(`shot w2 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W2, `${s.name}.png`), fullPage: false });
  });
}

// Wave 3 feature set (F18-F24): saved to KAFAA_SHOTS_W3.
const SHOTS_W3 = process.env.KAFAA_SHOTS_W3 || 'test-results/shots_w3';
mkdirSync(SHOTS_W3, { recursive: true });
const SET_W3: Shot[] = [
  { name: '01-talent-review-board-en', path: '/talent/review/trc-2026h2-ops', persona: 'ops-ceo' },
  { name: '02-succession-slate-en', path: '/talent/succession/ss-shift-supervisor-2026h2', persona: 'chco' },
  { name: '03-knowledge-loss-risk-en', path: '/knowledge/klra', persona: 'training-mgr' },
  { name: '04-knowledge-base-search-en', path: '/knowledge', persona: 'qc-inspector', then: async (p) => { await p.locator('[data-testid="m24-kb-search"]').fill('peer check redundant train'); await p.waitForTimeout(500); } },
  { name: '05-handover-2030-board-en', path: '/workforce/handover', persona: 'chco' },
  { name: '06-expert-reserve-en', path: '/opportunities/reserve/me', persona: 'sme-reviewer' },
  { name: '07-ai-fairness-monitor-en', path: '/admin/ai-transparency', persona: 'ai-governance', then: async (p) => { await p.getByRole('tab', { name: /Fairness monitor/ }).click(); } },
  { name: '08-recommendation-controls-en', path: '/my/settings', persona: 'nse', then: async (p) => { await p.locator('[data-testid="m16-reco-card"]').scrollIntoViewIfNeeded(); } },
  { name: '09-handover-2030-board-ar', path: '/workforce/handover', persona: 'chco', ar: true },
  { name: '10-succession-mobile', path: '/talent/succession', persona: 'chco', mobile: true },
];
for (const s of SET_W3) {
  test(`shot w3 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W3, `${s.name}.png`), fullPage: false });
  });
}

// Wave 4 feature set (F25-F31): saved to KAFAA_SHOTS_W4.
const SHOTS_W4 = process.env.KAFAA_SHOTS_W4 || 'test-results/shots_w4';
mkdirSync(SHOTS_W4, { recursive: true });
const SET_W4: Shot[] = [
  { name: '01-training-effectiveness-en', path: '/training/effectiveness/c-hu', persona: 'training-mgr' },
  { name: '02-training-needs-forecast-en', path: '/training/needs', persona: 'training-mgr' },
  { name: '03-sat-training-matrix-en', path: '/training/sat/roles/local-operator', persona: 'training-mgr', then: async (p) => { await p.getByRole('tab', { name: /Training matrix/ }).click(); } },
  { name: '04-simulator-coverage-en', path: '/training/simulator/scenarios', persona: 'training-mgr', then: async (p) => { await p.getByRole('tab', { name: /Cycle planner/ }).click(); } },
  { name: '05-accreditation-self-eval-en', path: '/training/accreditation/ase-coit-2026-H2', persona: 'training-mgr' },
  { name: '06-learning-record-store-en', path: '/training/lrs', persona: 'training-mgr' },
  { name: '07-my-learning-record-en', path: '/my/learning-record', persona: 'nse' },
  { name: '08-instructor-pipeline-en', path: '/training/instructors', persona: 'training-mgr' },
  { name: '09-sat-workbench-ar', path: '/training/sat', persona: 'training-mgr', ar: true },
  { name: '10-instructor-track-mobile', path: '/my/instructor', persona: 'sme-reviewer', mobile: true },
];
for (const s of SET_W4) {
  test(`shot w4 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W4, `${s.name}.png`), fullPage: false });
  });
}

// Wave 5 feature set (F32-F38): saved to KAFAA_SHOTS_W5.
const SHOTS_W5 = process.env.KAFAA_SHOTS_W5 || 'test-results/shots_w5';
mkdirSync(SHOTS_W5, { recursive: true });
const SET_W5: Shot[] = [
  { name: '01-micro-credentials-en', path: '/my/skills/credentials', persona: 'qc-inspector' },
  { name: '02-ojt-logbook-en', path: '/my/ojt', persona: 'qc-inspector' },
  { name: '03-contractor-passport-matrix-en', path: '/partner/workforce/passport', persona: 'alnoor-gm' },
  { name: '04-equivalency-precheck-en', path: '/partner/workforce/precheck?person=c-alnoor-06&standard=qs-elec', persona: 'alnoor-gm', then: async (p) => { await p.locator('[data-testid="m09-pc-run"]').click(); await p.locator('[data-testid="m09-pc-result"]').waitFor(); } },
  { name: '05-student-journey-en', path: '/pathways/journey', then: async (p) => { await p.locator('[data-testid="m06-journey-stage-finishing_school"]').click(); } },
  { name: '06-skills-outlook-simulated-en', path: '/workforce/skills-outlook', persona: 'chco' },
  { name: '07-weekly-digest-en', path: '/my', persona: 'sq-lead', then: async (p) => { await p.locator('[data-testid="digest-panel"]').scrollIntoViewIfNeeded(); } },
  { name: '08-dalil-career-mode-en', path: '/ask?mode=career', persona: 'nse', then: async (p) => { await p.locator('[data-testid="m13-input"]').fill('What do I need for SRO?'); await p.locator('[data-testid="m13-send"]').click(); await expect(p.locator('[data-testid="m13-answer"]').last()).toBeVisible(); } },
  { name: '09-student-journey-parents-ar', path: '/pathways/journey/parents?stage=finishing_school&route=dnt&families=operations', ar: true },
  { name: '10-ojt-logbook-mobile', path: '/my/ojt', persona: 'qc-inspector', mobile: true },
];
for (const s of SET_W5) {
  test(`shot w5 ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_W5, `${s.name}.png`), fullPage: false });
  });
}

// FS wave A feature set (FS01-FS06): saved to KAFAA_SHOTS_FSA.
const SHOTS_FSA = process.env.KAFAA_SHOTS_FSA || 'test-results/shots_fsA';
mkdirSync(SHOTS_FSA, { recursive: true });
const SET_FSA: Shot[] = [
  { name: '01-benchmark-registry-en', path: '/admin/frameworks?tab=benchmarks', persona: 'ai-governance' },
  { name: '02-skills-catalogue-en', path: '/admin/frameworks?tab=skills', persona: 'ai-governance' },
  { name: '03-skill-confidence-bands-en', path: '/my/skills/confidence', persona: 'nse' },
  { name: '04-half-lives-admin-en', path: '/admin/skills-confidence', persona: 'ai-governance' },
  { name: '05-future-skills-radar-en', path: '/workforce/future', persona: 'chco' },
  { name: '06-role-horizons-2030-en', path: '/careers/roles/reactor-operator?tab=horizons', then: async (p) => { await p.locator('[data-testid="m01-horizon-2030"]').click(); } },
  { name: '07-task-layer-ai-exposure-en', path: '/training/sat/future', persona: 'training-mgr' },
  { name: '08-keyspace-en', path: '/workforce/future/keyspace', persona: 'chco' },
  { name: '09-careers-horizons-ar', path: '/careers/horizons', ar: true },
  { name: '10-skill-confidence-mobile', path: '/my/skills/confidence', persona: 'nse', mobile: true },
];
for (const s of SET_FSA) {
  test(`shot fsa ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_FSA, `${s.name}.png`), fullPage: false });
  });
}

// FS wave B feature set (FS07-FS16): saved to KAFAA_SHOTS_FSB.
const SHOTS_FSB = process.env.KAFAA_SHOTS_FSB || 'test-results/shots_fsB';
mkdirSync(SHOTS_FSB, { recursive: true });
const SET_FSB: Shot[] = [
  { name: '01-skills-explorer-en', path: '/skills' },
  { name: '02-skill-crosswalk-en', path: '/skills/sk-fs-tr-analytical?tab=crosswalk' },
  { name: '03-ai-fluency-ladder-en', path: '/my/ai-fluency', persona: 'nse' },
  { name: '04-ai-fitness-workforce-en', path: '/workforce/ai-fluency', persona: 'chco' },
  { name: '05-my-role-2030-en', path: '/my/role-2030?role=reactor-operator', persona: 'sro' },
  { name: '06-task-exposure-en', path: '/my/role-2030/tasks?role=reactor-operator', persona: 'sro' },
  { name: '07-future-me-lanes-en', path: '/my/future', persona: 'nse', then: async (p) => { await p.locator('[data-testid="m21-raises"]').scrollIntoViewIfNeeded(); } },
  { name: '08-future-roles-navigator-en', path: '/my/career', persona: 'sro', then: async (p) => { await p.locator('[data-testid="m18-fs15"]').scrollIntoViewIfNeeded(); } },
  { name: '09-outlook-criteria-ar', path: '/careers/outlook-criteria', ar: true },
  { name: '10-my-role-2030-mobile', path: '/my/role-2030', persona: 'sro', mobile: true },
];
for (const s of SET_FSB) {
  test(`shot fsb ${s.name}`, async ({ page }) => {
    if (!s.mobile) await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_FSB, `${s.name}.png`), fullPage: false });
  });
}

// FS wave C feature set (FS17-FS26): saved to KAFAA_SHOTS_FSC.
const SHOTS_FSC = process.env.KAFAA_SHOTS_FSC || 'test-results/shots_fsC';
mkdirSync(SHOTS_FSC, { recursive: true });
const SET_FSC: Shot[] = [
  { name: '01-learning-pathway-en', path: '/learn/pathways/pw-ai-verify-l2', persona: 'nse' },
  { name: '02-external-catalogue-en', path: '/learn/external', persona: 'nse' },
  { name: '03-course-pack-en', path: '/learn/future-skills', persona: 'nse' },
  { name: '04-academy-en', path: '/learn/academies/ac-ai' },
  { name: '05-adaptive-result-en', path: '/my/assessments/adaptive/ab-ai-literacy', persona: 'nse', then: async (p) => { await p.locator('[data-testid="m05-take-result"]').scrollIntoViewIfNeeded(); } },
  { name: '06-performance-task-rubric-en', path: '/my/assessments/tasks/pt-feedwater-drift', persona: 'nse' },
  { name: '07-skill-descriptors-en', path: '/competencies/descriptors/sk-fs-ai-verify' },
  { name: '08-my-core-skills-en', path: '/my/core-skills', persona: 'nse' },
  { name: '09-scale-map-ar', path: '/competencies/scale', ar: true },
  { name: '10-sjt-practice-mobile', path: '/my/core-skills/practice', persona: 'nse', mobile: true },
];
for (const s of SET_FSC) {
  test(`shot fsc ${s.name}`, async ({ page }) => {
    if (!s.mobile) await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_FSC, `${s.name}.png`), fullPage: false });
  });
}

// FS wave D feature set (FS27-FS37): saved to KAFAA_SHOTS_FSD.
const SHOTS_FSD = process.env.KAFAA_SHOTS_FSD || 'test-results/shots_fsD';
mkdirSync(SHOTS_FSD, { recursive: true });
const SET_FSD: Shot[] = [
  { name: '01-future-gigs-en', path: '/opportunities/future', persona: 'nse' },
  { name: '02-strategic-gig-unlocked-en', path: '/opportunities/fg-ai-chem-trend-flags', persona: 'sro', then: async (p) => { await p.locator('[data-testid="m20-strategic-gate"]').scrollIntoViewIfNeeded(); } },
  { name: '03-rpl-request-decided-en', path: '/my/recognition/rpl/rpl-p-sro-01', persona: 'sro' },
  { name: '04-my-credits-en', path: '/my/credits', persona: 'sro' },
  { name: '05-future-credentials-en', path: '/my/skills/credentials/future', persona: 'sro' },
  { name: '06-translator-en', path: '/careers/translate', then: async (p) => { await p.locator('[data-testid="m18-fs34-occupation"]').first().click(); await p.locator('[data-testid="m18-fs34-results"]').scrollIntoViewIfNeeded(); } },
  { name: '07-career-health-en', path: '/my/career/health', persona: 'nse' },
  { name: '08-ai-literacy-register-en', path: '/workforce/ai-register', persona: 'chco' },
  { name: '09-recognition-nqf-ar', path: '/recognition?tab=nqf', ar: true },
  { name: '10-ai-drill-mobile', path: '/my/ai-fluency/drills/ad-valve-lineup', persona: 'qc-inspector', mobile: true },
];
for (const s of SET_FSD) {
  test(`shot fsd ${s.name}`, async ({ page }) => {
    if (!s.mobile) await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, s);
    await page.screenshot({ path: join(SHOTS_FSD, `${s.name}.png`), fullPage: false });
  });
}

// FS wave E (FS38-FS49): every new page (and the pages the wave-E wiring touched) in Arabic RTL and at 390 px, plus the feature set
// saved to KAFAA_SHOTS_FSE. LOCAL backend: the wave-E QA session had no live access (no demo password); rerun in supabase mode after
// the live apply by switching openFse to open().
async function openFse(page: Page, s: Shot) {
  await pinBackend(page, 'local', s.persona ?? null);
  if (s.mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${s.ar ? '/ar' : ''}${s.path === '/' && s.ar ? '' : s.path}`);
  await settle(page);
  if (s.then) {
    await s.then(page);
    await settle(page);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
const FSE_PAGES: Shot[] = [
  { name: 'fse-careers-next-gen', path: '/careers/next-gen?role=reactor-operator' },
  { name: 'fse-my-next-gen', path: '/my/next-gen', persona: 'k-ro' },
  { name: 'fse-workforce-next-gen', path: '/workforce/next-gen', persona: 'chco' },
  { name: 'fse-admin-next-gen', path: '/admin/next-gen', persona: 'training-mgr' },
  { name: 'fse-plant-literacy', path: '/learn/plant-literacy', persona: 'buyer' },
  { name: 'fse-plant-literacy-step', path: '/learn/plant-literacy', persona: 'buyer', then: async (p) => { await p.locator('[data-testid="m31-pl-start"]').first().click(); await p.locator('[data-testid="m31-pl-next"]').click(); } },
  { name: 'fse-plant-log', path: '/my/plant-log', persona: 'buyer' },
  { name: 'fse-plant-log-host', path: '/my/plant-log?tab=host', persona: 'k-instructor' },
  { name: 'fse-twin-drills', path: '/my/twin-drills', persona: 'qc-inspector' },
  { name: 'fse-twin-drill', path: '/my/twin-drills/tw-fw-bearing', persona: 'buyer' },
  { name: 'fse-training-twin-drills', path: '/training/twin-drills', persona: 'training-mgr' },
  { name: 'fse-clean-energy', path: '/skills/clean-energy' },
  { name: 'fse-cec-competence', path: '/skills/clean-energy/cec-3-2' },
  { name: 'fse-my-clean-energy', path: '/my/clean-energy', persona: 'head-sustainability' },
  { name: 'fse-workforce-clean-energy', path: '/workforce/clean-energy', persona: 'chco' },
  { name: 'fse-energy-transition', path: '/learn/energy-transition', persona: 'k-ro' },
  { name: 'fse-esg-managers', path: '/learn/energy-transition/esg-managers', persona: 'k-ro' },
  { name: 'fse-value-chain', path: '/learn/energy-transition/vc-hydrogen', persona: 'k-ro' },
  { name: 'fse-lectures', path: '/knowledge/lectures', persona: 'nse' },
  { name: 'fse-lecture', path: '/knowledge/lectures/lec-001', persona: 'nse' },
  { name: 'fse-contributions', path: '/knowledge/contributions', persona: 'training-mgr' },
  { name: 'fse-localisation', path: '/knowledge/localisation', persona: 'training-mgr' },
  { name: 'fse-behaviours', path: '/leadership/behaviours', persona: 'qc-inspector' },
  { name: 'fse-future-leaders', path: '/leadership/future-leaders', persona: 'qc-inspector' },
  { name: 'fse-future-leaders-manage', path: '/leadership/future-leaders/manage', persona: 'chco' },
  { name: 'fse-women-in-nuclear', path: '/communities/women-in-nuclear', persona: 'qc-inspector' },
  { name: 'fse-women-programme', path: '/communities/women-in-nuclear/programme', persona: 'training-mgr' },
  { name: 'fse-safety-culture-ai', path: '/my/safety-culture/ai', persona: 'qc-inspector' },
  { name: 'fse-hu-tools-admin', path: '/admin/hu-tools', persona: 'training-mgr' },
  { name: 'fse-handover-panel', path: '/workforce/handover', persona: 'chco' },
  { name: 'fse-credential-twins', path: '/my/skills/credentials/c/MC-TWINS', persona: 'nse' },
  { name: 'fse-credential-clean-energy', path: '/my/skills/credentials/c/MC-CLEAN-ENERGY', persona: 'nse' },
  { name: 'fse-gig-twin-drills', path: '/opportunities/fg-dig-twin-validation', persona: 'nse' },
  { name: 'fse-future-me', path: '/my/future', persona: 'nse' },
];
for (const s of FSE_PAGES) {
  test(`rtl ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await openFse(page, { ...s, ar: true });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    expect(await overflowX(page), 'no horizontal scroll').toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    await page.screenshot({ path: join(OUT, 'rtl', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
  test(`mobile ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await openFse(page, { ...s, mobile: true });
    expect(await overflowX(page), `${s.name}: page scrolls sideways at 390 px`).toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    await page.screenshot({ path: join(OUT, 'mobile', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
}
const SHOTS_FSE = process.env.KAFAA_SHOTS_FSE || 'test-results/shots_fsE';
mkdirSync(SHOTS_FSE, { recursive: true });
const SET_FSE: Shot[] = [
  { name: '01-smr-delta-grid-en', path: '/careers/next-gen?role=reactor-operator' },
  { name: '02-my-smr-delta-en', path: '/my/next-gen', persona: 'k-ro' },
  { name: '03-plant-literacy-en', path: '/learn/plant-literacy', persona: 'buyer', then: async (p) => { await p.locator('[data-testid="m31-pl-start"]').first().click(); } },
  { name: '04-twin-drill-en', path: '/my/twin-drills/tw-fw-bearing', persona: 'buyer' },
  { name: '05-clean-energy-comp-en', path: '/skills/clean-energy' },
  { name: '06-value-chain-en', path: '/learn/energy-transition/vc-hydrogen', persona: 'k-ro' },
  { name: '07-lecture-library-en', path: '/knowledge/lectures', persona: 'nse' },
  { name: '08-localisation-countdown-en', path: '/knowledge/localisation', persona: 'training-mgr' },
  { name: '09-future-leaders-ar', path: '/leadership/future-leaders', persona: 'qc-inspector', ar: true },
  { name: '10-safety-culture-ai-mobile', path: '/my/safety-culture/ai', persona: 'qc-inspector', mobile: true },
];
for (const s of SET_FSE) {
  test(`shot fse ${s.name}`, async ({ page }) => {
    if (!s.mobile) await page.setViewportSize({ width: 1440, height: 900 });
    await openFse(page, s);
    await page.screenshot({ path: join(SHOTS_FSE, `${s.name}.png`), fullPage: false });
  });
}

// FS wave F (FS50-FS59): every new page (and the pages the wave-F wiring touched) in Arabic RTL and at 390 px, plus the feature set
// saved to KAFAA_SHOTS_FSF. LOCAL backend (openFse): the wave-F QA session had no live access; rerun in supabase mode after the live apply.
const FSF_PAGES: Shot[] = [
  { name: 'fsf-critical-skills', path: '/workforce/critical-skills', persona: 'chco' },
  { name: 'fsf-critical-skill', path: '/workforce/critical-skills/cs-sk-fs-ai-verify', persona: 'chco' },
  { name: 'fsf-skill-forecasts', path: '/workforce/skill-forecasts', persona: 'training-mgr' },
  { name: 'fsf-skill-forecast', path: '/workforce/skill-forecasts/skills/sk-fs-ai-verify', persona: 'k-hr-analyst' },
  { name: 'fsf-forecast-versions', path: '/workforce/skill-forecasts/versions', persona: 'chco' },
  { name: 'fsf-generations', path: '/workforce/skill-forecasts/generations', persona: 'training-mgr' },
  { name: 'fsf-forecast-method', path: '/workforce/skill-forecasts/method', persona: 'k-auditor' },
  { name: 'fsf-skills-outlook', path: '/workforce/skills-outlook', persona: 'chco' },
  { name: 'fsf-skills-outlook-manager', path: '/workforce/skills-outlook', persona: 'sro' },
  { name: 'fsf-workforce-overview', path: '/workforce', persona: 'sro' },
  { name: 'fsf-skills-changes', path: '/skills/changes' },
  { name: 'fsf-skills-change-propose', path: '/skills/changes/propose?kind=add', persona: 'k-ro' },
  { name: 'fsf-skills-council', path: '/admin/skills-council', persona: 'training-mgr' },
  { name: 'fsf-skills-health', path: '/admin/skills-health', persona: 'chco' },
  { name: 'fsf-datasheet', path: '/skills/datasheet' },
  { name: 'fsf-model-risk', path: '/admin/ai-transparency/model-risk', persona: 'k-auditor' },
  { name: 'fsf-ai-transparency', path: '/admin/ai-transparency', persona: 'k-admin' },
  { name: 'fsf-skill-change', path: '/training/skill-change', persona: 'chco' },
  { name: 'fsf-effectiveness-course', path: '/training/effectiveness/c-hu', persona: 'training-mgr' },
  { name: 'fsf-coverage', path: '/training/coverage', persona: 'training-mgr' },
  { name: 'fsf-coverage-backlog', path: '/training/coverage/backlog', persona: 'training-mgr' },
  { name: 'fsf-problem-solving', path: '/my/core-skills/problem-solving', persona: 'k-lo-trainee' },
  { name: 'fsf-problem-solving-run', path: '/my/core-skills/problem-solving', persona: 'k-lo-trainee', then: async (p) => { await p.locator('[data-testid="m33-aps-scenario"][data-id="aps-os-001"] [data-testid="m33-aps-start"]').click(); } },
  { name: 'fsf-aps-scenarios', path: '/training/aps/scenarios', persona: 'training-mgr' },
  { name: 'fsf-role-play-library', path: '/learn/role-play', persona: 'nse' },
  { name: 'fsf-my-role-play', path: '/my/role-play?tab=history', persona: 'k-ro' },
  { name: 'fsf-role-play-session', path: '/my/role-play/rp-st-01', persona: 'qc-inspector', then: async (p) => { await p.locator('[data-testid="m33-rp-start"]').click(); } },
  { name: 'fsf-training-role-play', path: '/training/role-play', persona: 'training-mgr' },
  { name: 'fsf-workforce-practice', path: '/workforce/core-skills/practice', persona: 'chco' },
  { name: 'fsf-my-digest', path: '/my', persona: 'training-mgr' },
];
for (const s of FSF_PAGES) {
  test(`rtl ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await openFse(page, { ...s, ar: true });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    expect(await overflowX(page), 'no horizontal scroll').toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    await page.screenshot({ path: join(OUT, 'rtl', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
  test(`mobile ${s.name}`, async ({ page }) => {
    const w = watchErrors(page);
    await openFse(page, { ...s, mobile: true });
    expect(await overflowX(page), `${s.name}: page scrolls sideways at 390 px`).toBeLessThanOrEqual(1);
    expect(await textIssues(page)).toEqual([]);
    await page.screenshot({ path: join(OUT, 'mobile', `${s.name}.png`), fullPage: true });
    expect(w.take()).toEqual([]);
  });
}
const SHOTS_FSF = process.env.KAFAA_SHOTS_FSF || 'test-results/shots_fsF';
mkdirSync(SHOTS_FSF, { recursive: true });
const SET_FSF: Shot[] = [
  { name: '01-critical-skills-register-en', path: '/workforce/critical-skills', persona: 'chco' },
  { name: '02-skill-forecast-bands-en', path: '/workforce/skill-forecasts/skills/sk-fs-ai-verify', persona: 'k-hr-analyst' },
  { name: '03-outlook-automation-en', path: '/workforce/skills-outlook', persona: 'chco', then: async (p) => { await p.locator('[data-testid="m07-au-card"]').scrollIntoViewIfNeeded(); } },
  { name: '04-market-lines-en', path: '/workforce/skills-outlook', persona: 'chco', then: async (p) => { await p.locator('[data-testid="m07-mk-panel-skills_outlook"]').scrollIntoViewIfNeeded(); } },
  { name: '05-skills-council-en', path: '/admin/skills-council', persona: 'training-mgr' },
  { name: '06-skills-datasheet-en', path: '/skills/datasheet' },
  { name: '07-coverage-whatif-en', path: '/training/coverage', persona: 'training-mgr', then: async (p) => { await p.locator('[data-testid="m25-cov-whatif"]').scrollIntoViewIfNeeded(); } },
  { name: '08-problem-solving-en', path: '/my/core-skills/problem-solving', persona: 'k-lo-trainee' },
  { name: '09-role-play-library-ar', path: '/learn/role-play', persona: 'nse', ar: true },
  { name: '10-skill-change-mobile', path: '/training/skill-change', persona: 'chco', mobile: true },
];
for (const s of SET_FSF) {
  test(`shot fsf ${s.name}`, async ({ page }) => {
    if (!s.mobile) await page.setViewportSize({ width: 1440, height: 900 });
    await openFse(page, s);
    await page.screenshot({ path: join(SHOTS_FSF, `${s.name}.png`), fullPage: false });
  });
}

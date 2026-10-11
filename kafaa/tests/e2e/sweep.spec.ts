/**
 * (a) Every route × every platform role. Supabase mode (the default backend) with real NEXUS demo sign-in through the
 * sign-in screen; the four roles that have no NEXUS demo account (applicant, university, observer, ecp_officer) run on
 * the local fallback backend. Per page: no page/console errors, guard outcome matches RBAC (checkGuard semantics), no
 * placeholder text, no raw i18n keys, no "undefined"/"NaN".
 */
import { test, expect } from '@playwright/test';
import { loadRoutes, fill, type SmokeRoute } from '../smoke/routes';
import { grantsFor, type PlatformRole, type Resource, type Level } from '../../src/auth/policy';
import { readFileSync } from 'node:fs';
import { BASE, pinBackend, settle, signIn, textIssues, watchErrors, writeOut, type Backend } from './helpers';

const ROUTES = loadRoutes();
const personas = JSON.parse(readFileSync('src/seed/personas.json', 'utf8')) as { persona: string; roles: PlatformRole[] }[];
type Guard = { signedIn?: boolean; anyRole?: PlatformRole[]; grant?: { res: Resource; levels: Level[] }; noTelemetry?: boolean };
/** The guard object literal from the loader's capture (which can run past the guard): cut at the balancing brace. */
function guardOf(r: SmokeRoute): Guard {
  let depth = 0;
  let end = 0;
  for (let i = 0; i < r.guard.length; i++) {
    if (r.guard[i] === '{') depth++;
    else if (r.guard[i] === '}' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  return new Function(`return (${r.guard.slice(0, end)});`)() as Guard;
}

function expected(r: SmokeRoute, roles: PlatformRole[] | null): 'ok' | 'signin' | 'forbidden' {
  const g = guardOf(r);
  if (!(g.signedIn || g.anyRole || g.grant)) return 'ok';
  if (!roles) return 'signin';
  if (!g.anyRole && !g.grant) return 'ok';
  const roleOk = !!g.anyRole && g.anyRole.some((x) => roles.includes(x));
  const grantOk = !!g.grant && g.grant.levels.some((l) => grantsFor(roles, g.grant!.res).has(l));
  return roleOk || grantOk ? 'ok' : 'forbidden';
}

/** One persona per platform role (some cover two). null = anonymous. */
export const MATRIX: { persona: string | null; backend: Backend; covers: string }[] = [
  { persona: null, backend: 'supabase', covers: 'public (anonymous)' },
  { persona: 'nse', backend: 'supabase', covers: 'employee' },
  { persona: 'chem-sup', backend: 'supabase', covers: 'manager' },
  { persona: 'presenter', backend: 'supabase', covers: 'auditor' },
  { persona: 'chco', backend: 'supabase', covers: 'hr_director, hr_analyst' },
  { persona: 'training-mgr', backend: 'supabase', covers: 'training_manager' },
  { persona: 'sq-lead', backend: 'supabase', covers: 'instructor' },
  { persona: 'head-sustainability', backend: 'supabase', covers: 'editor' },
  { persona: 'ai-governance', backend: 'supabase', covers: 'admin' },
  { persona: 'sro', backend: 'supabase', covers: 'licensed_operator' },
  { persona: 'rao', backend: 'supabase', covers: 'licensing_coord' },
  { persona: 'alnoor-gm', backend: 'supabase', covers: 'partner_admin' },
  { persona: 'alnoor-qaqc', backend: 'supabase', covers: 'partner_user' },
  { persona: 'k-student', backend: 'local', covers: 'applicant (no NEXUS account)' },
  { persona: 'k-university', backend: 'local', covers: 'university (no NEXUS account)' },
  { persona: 'k-observer', backend: 'local', covers: 'observer (no NEXUS account)' },
  { persona: 'k-ecp', backend: 'local', covers: 'ecp_officer (no NEXUS account)' },
];

const ONLY = process.env.E2E_ONLY ? new Set(process.env.E2E_ONLY.split(',')) : null;
// E2E_BACKEND=local runs every session on the local backend (signed in as the persona's card, no password): the wave-E QA used it when
// the live project could not be reached. The default stays supabase mode with real NEXUS sign-in.
const FORCE: Backend | null = process.env.E2E_BACKEND === 'local' ? 'local' : null;
// E2E_MODULES=M17,M18 limits the visited routes to those modules (quick reruns); the full sweep visits every route.
const MODS = process.env.E2E_MODULES ? new Set(process.env.E2E_MODULES.split(',')) : null;
const VISIT = MODS ? ROUTES.filter((r) => MODS.has(r.module)) : ROUTES;

test('route registry loaded', () => {
  expect(ROUTES.length).toBe(315); // FS wave E QA: + 27 (FS38-FS40 M31 9, FS41-FS43 M32 7, FS44/FS45 M24 4, FS46-FS48 M22 5, FS49 M08 2). FS wave D QA: + 29 (FS27/FS28 M20 6, FS29/FS30 M34 7, FS31-FS33 M17 7, FS34/FS35 M18 2, FS36/FS37 M29 7). FS wave C QA: + 32 (FS17/FS18 M19 6, FS19/FS20 M04 6, FS21/FS22 M05 7, FS23/FS24 M02 7, FS25/FS26 M33 6). FS wave B QA: + 15 routes (FS07/FS08 M28 4: /skills, /skills/:id, /skills/frameworks, /admin/skills/alignments; FS09/FS10 M29 5; FS11/FS12 M30 5; FS16 M18 /careers/outlook-criteria). FS wave A QA: + 6 routes (FS03 /my/skills/confidence, /admin/skills-confidence; FS04 /workforce/future/keyspace; FS05 /careers/horizons, /careers/roles/:slug/profile; FS06 /training/sat/future). W5 QA: + 13 wave-5 routes (M17 my-skills-credentials, M02 my-ojt, team-ojt, M09 passport 3 + equivalency passport + contract roles, M06 journey, parents, workforce journeys, M07 skills outlook, admin digest). 98 + 20 wave-1 routes (M17 6, M18 3, M19 2, M20 6, M21 3) + 27 wave-2 routes (M04 2, M17 3, M18 3, M19 2, M20 7, M22 10) + 21 wave-3 routes (M23 8, M24 7, M07 1, M20 4, M16 1) + 27 wave-4 routes (M25 5, M26 9, M04 3, M27 6, M02 4)
});

for (const m of MATRIX) {
  const name = m.persona ?? 'anon';
  if (ONLY && !ONLY.has(name)) continue;
  const backend = FORCE ?? m.backend;
  test(`sweep ${name} [${backend}]`, async ({ page }) => {
    const card = m.persona ? personas.find((p) => p.persona === m.persona)! : null;
    const roles = card ? card.roles : null;
    await pinBackend(page, backend, backend === 'local' ? m.persona : null);
    const w = watchErrors(page);
    if (m.persona && backend === 'supabase') await signIn(page, m.persona);
    else await page.goto(`${BASE}/`);
    w.take();
    const results: { route: string; url: string; expect: string; got: string; issues: string[] }[] = [];
    const TRANSIENT = /net::ERR_(CONNECTION_RESET|CONNECTION_CLOSED|NETWORK_CHANGED|TIMED_OUT|HTTP2_PROTOCOL_ERROR)/;
    for (const r of VISIT) {
      const url = BASE + fill(r);
      for (let attempt = 1; attempt <= 2; attempt++) {
      await page.goto(url);
      let got = 'error';
      const issues: string[] = [];
      try {
        await settle(page);
        got = (await page.locator('[data-testid="signin-required"]').count())
          ? 'signin'
          : (await page.locator('[data-testid="forbidden"]').count())
            ? 'forbidden'
            : (await page.locator('[data-testid="page-crash"]').count())
              ? 'crash'
              : 'ok';
        issues.push(...(await textIssues(page)));
      } catch (e) {
        issues.push(`did not settle: ${(e as Error).message.split('\n')[0]}`);
      }
      const exp = expected(r, roles);
      if (got !== exp) issues.push(`guard: expected ${exp}, got ${got}`);
      issues.push(...w.take());
      // A dropped connection through the egress proxy is not a page defect: visit once more before reporting.
      if (attempt === 1 && issues.length && issues.every((x) => TRANSIENT.test(x))) continue;
      results.push({ route: r.id, url, expect: exp, got, issues });
      break;
      }
    }
    writeOut(`sweep-${name}${MODS ? '-' + [...MODS].join('_') : ''}.json`, { persona: name, backend, covers: m.covers, roles, results });
    const bad = results.filter((x) => x.issues.length);
    expect(bad.map((b) => `${b.route} (${b.url}): ${b.issues.join(' | ')}`), `${name}: ${bad.length} routes with issues`).toEqual([]);
  });
}

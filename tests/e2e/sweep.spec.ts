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
// E2E_MODULES=M17,M18 limits the visited routes to those modules (quick reruns); the full sweep visits every route.
const MODS = process.env.E2E_MODULES ? new Set(process.env.E2E_MODULES.split(',')) : null;
const VISIT = MODS ? ROUTES.filter((r) => MODS.has(r.module)) : ROUTES;

test('route registry loaded', () => {
  expect(ROUTES.length).toBe(193); // 98 + 20 wave-1 routes (M17 6, M18 3, M19 2, M20 6, M21 3) + 27 wave-2 routes (M04 2, M17 3, M18 3, M19 2, M20 7, M22 10) + 21 wave-3 routes (M23 8, M24 7, M07 1, M20 4, M16 1) + 27 wave-4 routes (M25 5, M26 9, M04 3, M27 6, M02 4)
});

for (const m of MATRIX) {
  const name = m.persona ?? 'anon';
  if (ONLY && !ONLY.has(name)) continue;
  test(`sweep ${name} [${m.backend}]`, async ({ page }) => {
    const card = m.persona ? personas.find((p) => p.persona === m.persona)! : null;
    const roles = card ? card.roles : null;
    await pinBackend(page, m.backend, m.backend === 'local' ? m.persona : null);
    const w = watchErrors(page);
    if (m.persona && m.backend === 'supabase') await signIn(page, m.persona);
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
    writeOut(`sweep-${name}${MODS ? '-' + [...MODS].join('_') : ''}.json`, { persona: name, backend: m.backend, covers: m.covers, roles, results });
    const bad = results.filter((x) => x.issues.length);
    expect(bad.map((b) => `${b.route} (${b.url}): ${b.issues.join(' | ')}`), `${name}: ${bad.length} routes with issues`).toEqual([]);
  });
}

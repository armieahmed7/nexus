// [Persona sign-in 2026-10-12] 20261012161001_kafaa_persona_signin.sql: Kafa'a-only personas resolve through the JWT app_metadata claim
// that the kafaa-persona-signin Edge Function stamps; the NEXUS profile still wins, and the claim can never name a NEXUS persona.
const KUID = '00000000-0000-4000-9000-00000000000a'; // a Kafa'a persona auth user: no NEXUS profile row

export default async function personaSignin({ db, as, ok, uid }) {
  const asClaims = async (claims, sql) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims)]);
    await db.exec(claims.role === 'anon' ? 'set role anon' : 'set role authenticated');
    try {
      return (await db.query(sql)).rows[0];
    } finally {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claims', '', false)`);
    }
  };
  const who = (claims) => asClaims(claims, 'select kafaa_whoami() w').then((r) => r.w);
  const kClaims = (persona, extra = {}) => ({ sub: KUID, role: 'authenticated', app_metadata: { provider: 'email', kafaa_persona: persona }, ...extra });

  const hasProfile = Number((await db.query(`select count(*)::int n from profiles where user_id = $1`, [KUID])).rows[0].n);
  ok(hasProfile === 0, 'persona sign-in: the Kafa\'a persona test user has no NEXUS profile');

  const lo = await who(kClaims('k-lo-trainee'));
  ok(lo.persona_id === 'k-lo-trainee' && lo.person_id === 'p-k-lo-trainee' && lo.roles.includes('employee'), 'persona sign-in: a k-* app_metadata claim resolves to the Kafa\'a person and roles');
  const adm = await who(kClaims('k-admin'));
  ok(adm.person_id === 'p-k-admin' && adm.roles.includes('admin') && adm.assignments.some((a) => a.role === 'admin' && a.scope_type === 'all'), 'persona sign-in: k-admin gets ADMIN:ALL from its live role assignments');
  const myOrg = await asClaims(kClaims('k-instructor'), 'select kafaa_my_org() o');
  ok(myOrg.o === 'enec-ops', 'persona sign-in: kafaa_my_org follows the Kafa\'a persona');

  const nexusName = await who(kClaims('sro'));
  ok(nexusName.person_id === null && nexusName.persona_id === null, 'persona sign-in: the claim can never name a NEXUS persona (k-* only)');
  const unknown = await who(kClaims('k-nobody'));
  ok(unknown.person_id === null && unknown.roles.length === 1 && unknown.roles[0] === 'public', 'persona sign-in: an unknown k-* persona resolves to no person');
  const userMeta = await who({ sub: KUID, role: 'authenticated', user_metadata: { kafaa_persona: 'k-admin' } });
  ok(userMeta.person_id === null, 'persona sign-in: user_metadata (user-writable) is ignored; only app_metadata counts');
  const anonRole = await asClaims({ role: 'anon', app_metadata: { kafaa_persona: 'k-admin' } }, 'select kafaa_me() me'); // kafaa_whoami is authenticated-only
  ok(anonRole.me === null, 'persona sign-in: the claim is ignored for the anon role');

  // A NEXUS account keeps its NEXUS persona even if a claim were present.
  const nexus = await who({ sub: uid['training-mgr'], role: 'authenticated', app_metadata: { kafaa_persona: 'k-admin' } });
  ok(nexus.persona_id === 'training-mgr', 'persona sign-in: a NEXUS profile wins over the claim');

  let helperDenied = 0;
  for (const fn of ['kafaa_jwt_persona()', 'kafaa_my_persona()']) {
    try {
      await as('training-mgr', `select ${fn}`);
    } catch {
      helperDenied++;
    }
  }
  ok(helperDenied === 2, 'persona sign-in: the two internal helpers are not callable by API roles');
}

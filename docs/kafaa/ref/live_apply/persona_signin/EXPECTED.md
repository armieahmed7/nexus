# Persona sign-in live-apply bundle: what to apply, in which order, and what to compare

Makes the 14 Kafa'a-only personas on `/kafaa/sign-in` (k-lo-trainee, k-ro, k-instructor, k-licensing-coord, k-hr-analyst, k-editor,
k-admin, k-auditor, k-ecp, k-student, k-graduate, k-university, k-observer, k-contractor) sign in for real on the deployed site, with
the data saved to the live `kafaa_*` tables, like the NEXUS role cards. Branch `claude/kafaa-persona-signin`. Nothing here has been
applied: the session that built it was read-only on live Supabase (project `hlirqxoddysxtdezwcgv`).

Two backend pieces, then the merge. There is **no secret and no password** to add anywhere: the Edge Function uses the service role
key that Supabase injects into every hosted function, and the browser never sees a password.

| step | what | how |
|---|---|---|
| 1 | SQL part `01_kafaa_persona_signin_p1.sql` | `apply_migration`, name `kafaa_persona_signin_p1`, then the checks in section 2 |
| 2 | Edge Function `kafaa-persona-signin` | `deploy_edge_function` (or `supabase functions deploy kafaa-persona-signin --project-ref hlirqxoddysxtdezwcgv`) from `kafaa/supabase/functions/kafaa-persona-signin/index.ts`; JWT verification can stay on (the portal sends the anon key). Then the checks in section 3 |
| 3 | merge the PR | production deploy of enec-kafaa (serves https://upskill.enecai.xyz/kafaa/ and https://enec-kafaa.netlify.app/kafaa/) |

Order matters only for the error text a visitor sees in between: before step 2 the cards say "not switched on for this site yet";
after step 2 but without step 1 they say "the live Kafa'a records do not recognise it yet" (the client signs that session out again).
Both offer "Use local demo data". Steps 1 and 2 can be done in either order before the merge; both must be done for the cards to work.

Optional function settings (Edge Function secrets, not needed with the defaults): `KAFAA_PERSONA_EMAIL_DOMAIN` (default
`personas.kafaa.demo`; no mail is ever sent to it) and `KAFAA_ALLOWED_ORIGINS` (CORS; default
`https://upskill.enecai.xyz,https://enec-kafaa.netlify.app,https://enecai.xyz,http://localhost:5173,http://localhost:4173`, plus
`https://<anything>--enec-kafaa.netlify.app` deploy previews).

Scope rules kept: `kafaa_*` functions only; no table, no row, no NEXUS object, no NEXUS auth user, no `profiles` row, no default
privilege. The Edge Function creates at most 14 new Auth users, all `@personas.kafaa.demo`, and touches no other user.

## 0. Before you start (read-only)

Live state recorded on 2026-10-12 by the building session; check it still holds, or stop and compare.

```sql
select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('kafaa_me', 'kafaa_whoami', 'kafaa_my_persona', 'kafaa_jwt_persona') order by 1;
```

| function | md5 now (must be live) | md5 after part 1 |
|---|---|---|
| `kafaa_jwt_persona()` | absent | `39e58d14327f81b24ca400bb99e88743` |
| `kafaa_me()` | `cdf4fbf473442fc3cb98af11d7424c99` | `82f7b125e374a8808b1a09d63ba10853` |
| `kafaa_my_persona()` | absent | `4aa36a47fb52a3db80db592749468579` |
| `kafaa_whoami()` | `4e857e323da3cba864b250da53c6d60f` | `0c2161dbe4998cf1aaad463b20309c6b` |

The 14 persona people and their 22 role assignments are already live (seeded with the earlier waves); part 1 adds none:

```sql
select count(*) as people, (select count(*) from kafaa_role_assignments ra join kafaa_people p on p.id = ra.person_id
  where p.persona_id like 'k-%' and ra.status = 'active') as active_assignments
from kafaa_people where persona_id like 'k-%' and status <> 'leaver';
-- expect: people = 14, active_assignments = 22
select count(*) from auth.users where email like '%@personas.kafaa.demo';   -- expect 0 before step 2 is first used
```

## 1. Part

| # | apply_migration name | what it does |
|---|---|---|
| 1 | `kafaa_persona_signin_p1` | functions: new `kafaa_jwt_persona()` (reads `app_metadata.kafaa_persona` from `request.jwt.claims`; role `authenticated` and `k-*` ids only), new `kafaa_my_persona()` (= `coalesce(nexus_my_persona(), kafaa_jwt_persona())`), `kafaa_me()` and `kafaa_whoami()` redefined to use it; 2 revoke statements (the two new helpers are internal) |

## 2. After part 1

```sql
-- md5s: compare with the table in section 0 (query above)

-- grants: kafaa_me and kafaa_whoami keep theirs; the two helpers are not callable by API roles
select p.proname, p.prosecdef,
  has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('kafaa_me', 'kafaa_whoami', 'kafaa_my_persona', 'kafaa_jwt_persona') order by 1;
```

| proname | prosecdef | anon | authenticated |
|---|---|---|---|
| kafaa_jwt_persona | false | false | false |
| kafaa_me | true | true | true |
| kafaa_my_persona | true | false | false |
| kafaa_whoami | true | false | true |

Behaviour, simulated in a rolled-back transaction (read-only; `set_config(..., true)` is transaction-local):

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-00000000000a","role":"authenticated","app_metadata":{"kafaa_persona":"k-admin"}}', true);
select kafaa_whoami() as w, kafaa_me() as me;
rollback;
-- expect: me = 'p-k-admin'; w.persona_id = 'k-admin', w.org_id = 'enec', w.roles contains 'admin', 'employee', 'public',
--         w.assignments has admin/all and employee/self (before part 1 this returned persona_id null, person_id null)

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-00000000000a","role":"authenticated","app_metadata":{"kafaa_persona":"sro"}}', true);
select kafaa_me() as me;   -- expect null: the claim can never name a NEXUS persona
rollback;

begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-00000000000a","role":"authenticated","user_metadata":{"kafaa_persona":"k-admin"}}', true);
select kafaa_me() as me;   -- expect null: user_metadata (user-writable) is ignored
rollback;

begin;   -- a NEXUS account is unchanged: its NEXUS profile still decides
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from profiles where persona_id = 'training-mgr'), 'role', 'authenticated',
  'app_metadata', json_build_object('kafaa_persona', 'k-admin'))::text, true);
select kafaa_whoami() ->> 'persona_id' as persona;   -- expect 'training-mgr'
rollback;
```

## 3. After the Edge Function is deployed

`list_edge_functions` shows `kafaa-persona-signin` ACTIVE. Then, from a browser on https://upskill.enecai.xyz/kafaa/sign-in (any
build of this branch, or production after the merge), choose "Platform admin" (k-admin): it lands on `/kafaa/admin` signed in, with
the "Kafa'a" badge on every Kafa'a persona card and no "Local demo only" badge anywhere.

```sql
select email, raw_app_meta_data ->> 'kafaa_persona' as persona, email_confirmed_at is not null as confirmed
from auth.users where email like '%@personas.kafaa.demo' order by 1;
-- expect one row per persona chosen so far (at most 14), persona = the e-mail's local part, confirmed = true
select count(*) from auth.users where email like '%@demo.enec-nexus.ae' and raw_app_meta_data ? 'kafaa_persona';   -- expect 0
select count(*) from profiles where persona_id like 'k-%';   -- expect 0: no NEXUS profile row is created
```

## 4. What these accounts can reach outside Kafa'a

A Kafa'a persona account is an ordinary `authenticated` user with no NEXUS profile, so every NEXUS policy that needs
`nexus_my_persona()` / `nexus_can_write()` refuses it, and `kafaa_ledger` (which needs a profile) writes no NEXUS ledger entry. NEXUS
policies granted to `authenticated` with `using (true)` do apply, as they do to the 43 NEXUS demo accounts: on 2026-10-12 these were
SELECT on `eco_adv_vendors`, `eco_courses` and `kill_switch_events`, and INSERT on `user_prefs` for the user's own `user_id`.

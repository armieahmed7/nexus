// [Audit 2026-10-12] PGlite checks for the five audit-fix migrations (20261012151001 .. 20261012155001).
//  a. grants: no API role holds TRUNCATE / REFERENCES / TRIGGER on any public table; on kafaa_* tables anon writes only the contact form,
//     nobody deletes, authenticated inserts/updates exactly where a policy admits it; staff update only the status of a contact request.
//  b. the ten RPC-only tables carry no kafaa_insert / kafaa_update policy and no <table>_audit trigger.
//  c. the 22 W3E2 foreign keys and 3 FK indexes exist; xAPI statements reject DELETE (one append-only trigger covers it on a fresh build).
//  e. the contact form insert check admits exactly the two public payloads and refuses the rest.
//  f. kafaa_verify_certificate audits every check and refuses the 21st check of one number within a minute.
// Data-changing checks run inside a transaction that is rolled back, so later validators see the seed unchanged.
import { readFileSync } from 'node:fs';
import { CONTACT_ROUTES, contactRequestProblems } from '../../src/domain/contact.ts';

const RPC_ONLY = ['advisor_sessions', 'advisor_turns', 'appeals', 'applications', 'equivalency_requests', 'icv_plans', 'item_versions', 'items', 'partner_onboarding', 'research_proposals'];
const FK_TABLES = ['asset_reviews', 'asset_uses', 'capture_sessions', 'klra_actions', 'klra_assessments', 'klra_positions', 'knowledge_assets', 'sme_profiles'];

export default async function auditFixChecks({ db, as, one, ok }) {
  console.log('Audit 2026-10-12 fixes (grants, RPC-only tables, integrity, contact form, certificate rate limit)');
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;

  // a. grants
  const extra = await q(`select c.relname t, r.rolname role from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('anon'), ('authenticated')) r(rolname)
    where n.nspname = 'public' and c.relkind in ('r', 'p') and (has_table_privilege(r.rolname, c.oid, 'TRUNCATE') or has_table_privilege(r.rolname, c.oid, 'REFERENCES') or has_table_privilege(r.rolname, c.oid, 'TRIGGER'))`);
  ok(extra.length === 0, `no API role holds TRUNCATE, REFERENCES or TRIGGER on a public table (${extra.length})`);
  const anonW = await q(`select c.relname t, p.priv from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\\_%' and has_table_privilege('anon', c.oid, p.priv)`);
  ok(anonW.length === 1 && anonW[0].t === 'kafaa_contact_requests' && anonW[0].priv === 'INSERT', `anon writes only the contact form (${anonW.map((r) => `${r.t}:${r.priv}`).join(', ')})`);
  const del = await q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\\_%'
    and has_table_privilege('authenticated', c.oid, 'DELETE')`);
  ok(del.length === 0, 'no signed-in user deletes rows of a Kafa\'a table directly');
  const mismatch = await q(`select c.relname t, x.cmd from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('INSERT'), ('UPDATE')) x(cmd)
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'kafaa\\_%' and c.relname <> 'kafaa_contact_requests'
      and has_table_privilege('authenticated', c.oid, x.cmd) <> exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
            and p.cmd in (x.cmd, 'ALL') and p.roles && array['authenticated', 'public']::name[])`);
  ok(mismatch.length === 0, `authenticated INSERT/UPDATE exactly where a policy admits it (${mismatch.map((r) => `${r.t}:${r.cmd}`).join(', ')})`);
  const cr = (await q(`select has_table_privilege('authenticated', 'kafaa_contact_requests', 'UPDATE') t, has_column_privilege('authenticated', 'kafaa_contact_requests', 'status', 'UPDATE') s,
    has_column_privilege('authenticated', 'kafaa_contact_requests', 'message', 'UPDATE') m`))[0];
  ok(!cr.t && cr.s && !cr.m, 'contact requests: staff may update the status column only');

  // b. RPC-only tables
  const pol = await q(`select tablename, policyname from pg_policies where schemaname = 'public' and tablename = any($1) and policyname in ('kafaa_insert', 'kafaa_update')`, [RPC_ONLY.map((t) => `kafaa_${t}`)]);
  const trg = await q(`select tgname from pg_trigger where tgname = any($1)`, [RPC_ONLY.map((t) => `kafaa_${t}_audit`)]);
  ok(pol.length === 0 && trg.length === 0, 'the ten RPC-only tables have no direct-write policy and no row audit trigger');

  // c. integrity
  const fks = await q(`select conname from pg_constraint where contype = 'f' and conrelid = any(select oid from pg_class where relname = any($1)) and conname like 'kafaa\\_%\\_fk'`, [FK_TABLES.map((t) => `kafaa_${t}`)]);
  ok(fks.length === 22, `22 foreign keys on the W3E2 knowledge tables (${fks.length})`);
  const idx = await q(`select indexname from pg_indexes where indexname in ('kafaa_career_targets_role_id_idx', 'kafaa_roadmaps_target_role_id_idx', 'kafaa_health_snapshots_role_id_idx')`);
  ok(idx.length === 3, 'the three FK-covering indexes exist');
  const xt = await q(`select tgname from pg_trigger where tgrelid = 'kafaa_xapi_statements'::regclass and not tgisinternal and tgfoid = 'kafaa_append_only()'::regprocedure and (tgtype & 8) <> 0`);
  ok(xt.length === 1 && xt[0].tgname === 'kafaa_xapi_statements_append_only', 'xAPI statements: one append-only trigger covers DELETE on a fresh build (the additive one is not created)');
  const mig = readFileSync('supabase/migrations/20261012153001_kafaa_audit_integrity.sql', 'utf8');
  ok((mig.match(/deferrable initially deferred/g) ?? []).length === 22, 'the 22 keys are deferrable, as in schema.sql');

  await db.exec('begin');
  try {
    const fails = async (persona, sql, params = []) => {
      await db.exec('savepoint s');
      try { await as(persona, sql, params); await db.exec('release savepoint s'); return false; } catch { await db.exec('rollback to savepoint s'); return true; }
    };
    const xid = (await q(`select id from kafaa_xapi_statements limit 1`))[0]?.id;
    let xDenied = false;
    if (xid) {
      await db.exec('savepoint x');
      try { await db.query(`delete from kafaa_xapi_statements where id = $1`, [xid]); await db.exec('release savepoint x'); } catch { xDenied = true; await db.exec('rollback to savepoint x'); }
    }
    ok(!!xid && xDenied, 'xAPI statements cannot be deleted (even by the owner)');

    // e. contact form
    const ins = `insert into kafaa_contact_requests (id, topic, route_to, name, email, message, status, lang, consent_contact, retention_until) values ($1, $2, $3, $4, $5, $6, coalesce($7, 'new'), 'en', false, $8::date)`;
    const keep = (days) => `(current_date + ${days})`;
    const okRow = ['con-audit-1', 'careers', CONTACT_ROUTES.careers, 'Test', 'careers@example.org', 'I would like to know more about the programmes.', 'routed', null];
    ok(!(await fails(null, ins.replace('$8::date', keep(180)), okRow.slice(0, 7))), 'contact form: the public form payload is accepted (status routed, topic mailbox, 180-day retention)');
    ok(await fails(null, `insert into kafaa_contact_requests (id, topic, route_to, message) values ('con-audit-r', 'careers', $1, 'Read it back') returning id`, [CONTACT_ROUTES.careers]),
      'contact form: a signed-out INSERT ... RETURNING fails (no SELECT for anon), so the forms insert with return=minimal');
    ok(!(await fails(null, `insert into kafaa_contact_requests (id, topic, route_to, name, email, message) values ('con-audit-2', 'suppliers', $1, 'Co', 'suppliers@example.org', 'Company: Co')`, [CONTACT_ROUTES.suppliers])), 'contact form: the supplier interest payload is accepted (default status)');
    const bad = [
      [['con-audit-3', 'careers', CONTACT_ROUTES.careers, null, null, 'hello there friend', 'closed', null], 'a closed status'],
      [['con-audit-4', 'careers', 'Somebody personal', null, null, 'hello there friend', 'new', null], 'a route that is not the topic mailbox'],
      [['con-audit-5', 'careers', CONTACT_ROUTES.media, null, null, 'hello there friend', 'new', null], 'another topic\'s mailbox'],
      [['con-audit-6', 'careers', CONTACT_ROUTES.careers, null, null, 'x'.repeat(4001), 'new', null], 'a message over 4000 characters'],
      [['con-audit-7', 'careers', CONTACT_ROUTES.careers, 'n'.repeat(201), null, 'hello there friend', 'new', null], 'a name over 200 characters'],
      [['x'.repeat(65), 'careers', CONTACT_ROUTES.careers, null, null, 'hello there friend', 'new', null], 'an id over 64 characters'],
    ];
    for (const [row, what] of bad) ok(await fails(null, ins.replace('$8::date', 'null'), row.slice(0, 7)), `contact form refuses ${what}`);
    ok(await fails(null, ins.replace('$8::date', keep(401)), ['con-audit-8', 'careers', CONTACT_ROUTES.careers, null, null, 'hello there friend', 'new']), 'contact form refuses a retention over 400 days');
    // the TS mirror agrees on the same cases
    ok(contactRequestProblems({ id: 'c', topic: 'careers', route_to: CONTACT_ROUTES.careers, message: 'hello', status: 'routed' }, '2026-10-08') === null
      && contactRequestProblems({ id: 'c', topic: 'careers', route_to: CONTACT_ROUTES.media, message: 'hello' }, '2026-10-08') !== null
      && contactRequestProblems({ id: 'c', topic: 'careers', route_to: CONTACT_ROUTES.careers, message: 'hello', status: 'closed' }, '2026-10-08') !== null, 'contactRequestProblems mirrors the SQL check');
    const up = await as('k-admin', `update kafaa_contact_requests set status = 'closed' where id = 'con-audit-1' returning id`);
    ok(up.length === 1, 'an admin closes a contact request (status column)');
    ok(await fails('k-admin', `update kafaa_contact_requests set message = 'changed' where id = 'con-audit-1'`), 'nobody edits the message of a sent contact request');
    ok((await as('sro', `update kafaa_contact_requests set status = 'routed' where id = 'con-audit-1' returning id`)).length === 0, 'non-admins cannot change contact request status');

    // f. certificate verification
    const certNo = (await q(`select id from kafaa_certificates order by id limit 1`))[0].id;
    const a0 = Number((await q(`select count(*)::int n from kafaa_audit_events where action = 'certificate.verify'`))[0].n);
    const first = (await one(null, `select kafaa_verify_certificate($1) r`, [certNo.toLowerCase()])).r;
    ok(first.found === true && !('person_id' in first) && Number((await q(`select count(*)::int n from kafaa_audit_events where action = 'certificate.verify'`))[0].n) === a0 + 1,
      'certificate check (any case) is found, carries no person id and writes one audit row');
    for (let k = 0; k < 19; k++) await one(null, `select kafaa_verify_certificate($1) r`, [certNo]);
    const limited = (await one(null, `select kafaa_verify_certificate($1) r`, [certNo])).r;
    ok(limited.found === false && limited.code === 'rate_limited', '21st check of one number within a minute is refused (rate_limited)');
    const other = (await one(null, `select kafaa_verify_certificate('NO-SUCH-CERT') r`)).r;
    ok(other.found === false && !other.code, 'other numbers are still checked (not found)');
    const fn = (await q(`select p.provolatile v, p.prosecdef d, has_function_privilege('anon', p.oid, 'execute') a from pg_proc p where p.proname = 'kafaa_verify_certificate'`))[0];
    ok(fn.v === 'v' && fn.d === true && fn.a === true, 'kafaa_verify_certificate is volatile, security definer and callable by anon');
  } finally {
    await db.exec('rollback');
  }
}

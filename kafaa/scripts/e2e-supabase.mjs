#!/usr/bin/env node
/**
 * End-to-end check of the Supabase backend against project hlirqxoddysxtdezwcgv with a real NEXUS role-card session.
 *   KAFAA_E2E_PASSWORD=<NEXUS demo password> node scripts/e2e-supabase.mjs [--write]
 * The password is never stored in this repo: pass it through the environment only.
 * Without --write the script is read-only. With --write it records ONE evaluation through kafaa_signoff_evaluation
 * (persona training-mgr signs task qs-ro-t4 on record qr-p-k-ro-qs-ro), which appends one kafaa_audit_events row
 * and one NEXUS ledger entry (plane PEOPLE, domain KAFAA).
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://hlirqxoddysxtdezwcgv.supabase.co';
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsaXJxeG9kZHlzeHRkZXp3Y2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODI3MjMsImV4cCI6MjEwNjI1ODcyM30.zLcxcZQhfdVriYwAna-lIBSajSG7ENfnrlHcCMJK6Zc';
const PASSWORD = process.env.KAFAA_E2E_PASSWORD;
const PERSONA = process.env.KAFAA_E2E_PERSONA || 'training-mgr';
const WRITE = process.argv.includes('--write');

if (!PASSWORD) {
  console.error('Set KAFAA_E2E_PASSWORD (the NEXUS demo password) in the environment.');
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

// 1. Anonymous: public reads work, protected reads return nothing.
const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
{
  const { data, error } = await anon.from('kafaa_job_roles').select('id').limit(5);
  check('anon reads public kafaa_job_roles', !error && (data?.length ?? 0) > 0, error?.message ?? `${data?.length} rows`);
  const q = await anon.from('kafaa_qual_records').select('id').limit(5);
  check('anon sees no kafaa_qual_records', !q.error && q.data.length === 0, q.error?.message ?? `${q.data.length} rows`);
  const r = await anon.rpc('kafaa_signoff_evaluation', { p: { record_id: 'qr-p-k-ro-qs-ro' } });
  check('anon cannot call write RPC', !!r.error, r.error?.code ?? 'no error');
}

// 2. Real NEXUS role-card session (password grant, exactly like NEXUS sign-in).
const tok = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'content-type': 'application/json' },
  body: JSON.stringify({ email: `${PERSONA}@demo.enec-nexus.ae`, password: PASSWORD }),
}).then((r) => r.json());
check(`NEXUS sign-in as ${PERSONA}`, !!tok.access_token, tok.error_description ?? tok.msg ?? '');
if (!tok.access_token) process.exit(1);

const db = createClient(URL, ANON, { accessToken: async () => tok.access_token });
{
  const me = await db.rpc('kafaa_me');
  check('kafaa_me() resolves the persona', me.data === `p-${PERSONA}`, JSON.stringify(me.data ?? me.error?.message));
  const roles = await db.rpc('kafaa_my_roles');
  check('kafaa_my_roles() returns grants', Array.isArray(roles.data) && roles.data.includes('instructor'), JSON.stringify(roles.data ?? roles.error?.message));
  const q = await db.from('kafaa_qual_records').select('id,person_id,status').eq('id', 'qr-p-k-ro-qs-ro');
  check('RLS read of an in-scope qualification record', !q.error && q.data.length === 1, q.error?.message ?? JSON.stringify(q.data));
}

if (WRITE) {
  const before = await db.from('kafaa_evaluations').select('id', { count: 'exact', head: true }).eq('record_id', 'qr-p-k-ro-qs-ro');
  const r = await db.rpc('kafaa_signoff_evaluation', {
    p: { record_id: 'qr-p-k-ro-qs-ro', task_id: 'qs-ro-t4', result: 'pass', method: 'ojt' },
  });
  const res = r.data ?? {};
  check('kafaa_signoff_evaluation ok', !r.error && res.ok === true, r.error?.message ?? JSON.stringify(res));
  check('audit row appended (hash chain)', typeof res.audit_seq === 'number' || !!res.audit?.seq, JSON.stringify(res.audit ?? res.audit_seq));
  check('NEXUS ledger entry appended', res.ledger_seq != null || res.ledger != null, JSON.stringify(res.ledger_seq ?? res.ledger));
  const after = await db.from('kafaa_evaluations').select('id', { count: 'exact', head: true }).eq('record_id', 'qr-p-k-ro-qs-ro');
  check('evaluation visible through RLS', (after.count ?? 0) === (before.count ?? 0) + 1, `${before.count} -> ${after.count}`);
  const self = await db.rpc('kafaa_signoff_evaluation', { p: { record_id: 'qr-p-training-mgr-qs-ro' } });
  check('refusal path returns {ok:false}', !self.error && self.data?.ok === false, JSON.stringify(self.data ?? self.error?.message));
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

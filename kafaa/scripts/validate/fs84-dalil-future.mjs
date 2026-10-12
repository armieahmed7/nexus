// [FS wave H · E4 · FS76] PGlite checks for 20261010284001_kafaa_fs84_dalil_future.sql (Dalil future-skills mode). Seed sanity (the four intents
// equal src/modules/m13/career/futureIntents.ts: examples, cited routes, https sources, the FS76 benchmarks; the seeded future-skills
// conversations name only synthetic workers or none, are dated after the demo digest date and keep the F37 log shape); SQL = TS parity
// (kafaa_dl_intent_base = intentBase(), the personal-intent pattern = isPersonalIntent()); RLS (everyone reads the public catalogue, nobody
// writes it directly); RPC flows and RBAC inside a rolled-back transaction (only the AI owner switches an intent, with a reason, audited and
// ledgered; a switched-off intent is refused by the turn log; personal answers only for staff with a skills profile; staff turns become
// career turns, partners keep their own mode; the kill switch still stops everything); grants (anon executes nothing new); additivity.
import { readFileSync } from 'node:fs';
import { FUTURE_INTENTS, intentBase, isPersonalIntent } from '../../src/modules/m13/career/futureIntents.ts';

const BANNED = [['dr', 'op'], ['del', 'ete'], ['trun', 'cate']].map((p) => p.join('')); // destructive SQL words, spelled so this file does not contain them
const MIG = 'supabase/migrations/20261010284001_kafaa_fs84_dalil_future.sql';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));

export default async function fs84Checks({ db, one, ok }) {
  console.log('FS wave H · E4 · FS76 Dalil future-skills mode');
  await db.exec('reset role');
  const T = JSON.parse(readFileSync('src/seed/seed.json', 'utf8')).tables;
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;

  // ── seed sanity
  const rows = await q('select * from kafaa_dalil_intents order by sort');
  const same = rows.length === FUTURE_INTENTS.length && FUTURE_INTENTS.every((d, i) => {
    const r = rows[i];
    return r.id === d.id && r.kind === d.kind && r.audience === d.audience && r.feature === d.feature && canon(r.examples_en) === canon(d.examples_en) && canon(r.examples_ar) === canon(d.examples_ar)
      && canon(r.cites) === canon(d.cites) && canon(r.sources) === canon(d.sources) && canon(r.benchmark_ids) === canon(d.benchmark_ids) && r.enabled === true;
  });
  ok(same && rows.every((r) => r.sources.length > 0 && r.sources.every((s) => /^https:\/\//.test(s.url) && s.as_of) && r.examples_en.length >= 2 && r.examples_ar.length >= 2 && r.benchmark_ids.every((b) => ['SG-CAREER', 'AI-LIT'].includes(b))),
    `seed: the ${rows.length} future-skills intents equal futureIntents.ts (EN/AR examples, cited routes, https sources with as-of dates, FS76 benchmarks), all switched on`);
  const fut = T.advisor_turns.filter((t) => intentBase(t.intent) || String(t.intent ?? '').startsWith('career.concept'));
  const ses = T.advisor_sessions.filter((s) => s.id.startsWith('as-future-'));
  const people = new Map(T.people.map((p) => [p.id, p]));
  ok(ses.length === 4 && ses.every((s) => s.started_at.slice(0, 10) > '2026-10-08' && (s.person_id === null ? s.mode === 'public' && s.client_key && !s.submode : people.get(s.person_id)?.persona_id === null && s.mode === 'staff' && s.submode === 'career'))
    && fut.length > 0 && fut.every((t) => ses.some((s) => s.id === t.session_id)),
    'seed: three staff future-skills conversations (synthetic workers, career sessions) and one anonymous public one (client key only), dated after 2026-10-08');
  const run = T.eval_runs.find((e) => e.id === 'eval-2026-10-fs76');
  ok(!!run && run.pass === true && run.engine === 'retrieval-v1+career-v1+future-v1' && run.cited_correct / run.in_scope_total >= 0.95 && run.security_correct === run.security_total,
    `seed: release gate r1.1 runs the public, career and future-skills sets (${run?.cited_correct}/${run?.in_scope_total} cited, security ${run?.security_correct}/${run?.security_total})`);

  // ── parity
  const inputs = ['future.role_2030.personal', 'future.ai_rung.public', 'future.skill_crosswalk', 'future.pathway_gap.sign_in', 'future.role_2030.concept.personal', 'career.gap_to_role', 'future.', 'futures.x', 'future.Role', '', null, 'xfuture.ai_rung', 'future.ai-rung'];
  const diff = [];
  for (const s of inputs) {
    const [r] = await q(`select kafaa_dl_intent_base($1) b, coalesce($1, '') ~ '^future\\.[a-z0-9_]+\\.personal$' p`, [s]);
    if (r.b !== intentBase(s) || r.p !== isPersonalIntent(s)) diff.push(`${s}: SQL ${r.b}/${r.p} vs TS ${intentBase(s)}/${isPersonalIntent(s)}`);
  }
  ok(diff.length === 0, `parity: kafaa_dl_intent_base = intentBase() and the personal pattern = isPersonalIntent() on ${inputs.length} intents${diff[0] ? ` (${diff[0]})` : ''}`);

  // ── RLS
  const anonN = Number((await one(null, 'select count(*)::int n from kafaa_dalil_intents')).n);
  const staffN = Number((await one('sro', 'select count(*)::int n from kafaa_dalil_intents')).n);
  let direct = 0;
  for (const who of [null, 'k-admin']) { try { const r = await one(who, `update kafaa_dalil_intents set enabled = false where id = 'future.ai_rung' returning id`); if (!r) direct++; } catch { direct++; } }
  const still = (await q(`select enabled from kafaa_dalil_intents where id = 'future.ai_rung'`))[0].enabled;
  ok(anonN === rows.length && staffN === rows.length && direct === 2 && still === true, 'RLS: anonymous visitors and staff read the public catalogue; nobody (not even the AI owner) changes it with a direct write');

  // ── RPC flows (rolled back)
  await db.exec('begin');
  try {
    const r = async (who, sql, p = []) => (await one(who, sql, p)).r;
    const led = async () => Number((await q('select count(*)::int n from ledger_entries'))[0].n);
    const aud = async (action) => Number((await q('select count(*)::int n from kafaa_audit_events where action = $1', [action]))[0].n);
    const turnsN = async () => Number((await q('select count(*)::int n from kafaa_advisor_turns'))[0].n);
    const sw = (who, id, on, note) => r(who, 'select kafaa_set_dalil_intent($1, $2, $3) r', [id, on, note]);
    const f1 = await sw('training-mgr', 'future.ai_rung', false, 'Pausing for review');
    const f2 = await sw('k-auditor', 'future.ai_rung', false, 'Pausing for review');
    const f3 = await sw('k-admin', 'future.ai_rung', false, 'no');
    const f4 = await sw('k-admin', 'future.nothing', false, 'Pausing for review');
    const f5 = await sw('k-admin', 'future.ai_rung', true, 'Already on, check');
    ok(f1.code === 'forbidden' && f2.code === 'forbidden' && f3.code === 'invalid' && f4.code === 'not_found' && f5.code === 'unchanged',
      'setDalilIntent: only the AI owner (dalil_config A) switches an intent; a reason of 5-300 characters is required; unknown and unchanged intents are refused');
    const l0 = await led(), a0 = await aud('dalil.intent');
    const off = await sw('k-admin', 'future.ai_rung', false, 'Ladder targets under review this week');
    const row = (await q(`select enabled, changed_role, change_note, changed_at from kafaa_dalil_intents where id = 'future.ai_rung'`))[0];
    ok(off.ok && off.data.enabled === false && row.enabled === false && row.changed_role === 'admin' && row.change_note === 'Ladder targets under review this week' && !!row.changed_at && (await led()) === l0 + 1 && (await aud('dalil.intent')) === a0 + 1,
      'setDalilIntent: the AI owner switches an intent off with a reason; the row keeps the acting role, time and reason; one audit row and one NEXUS ledger entry');
    const turn = (extra = {}) => JSON.stringify({ question: 'Which AI rung do I need?', answer: 'Operations roles aim for Practitioner.', citations: [{ label: 'AI fluency ladder', url: '/learn/ai-fluency' }], refused: false, intent: 'future.ai_rung.personal', confidence: 1, personal: true, ...extra });
    const t0 = await turnsN(), ad0 = await aud('dalil.future_turn');
    const dis = await r('sro', 'select kafaa_dalil_future_turn($1::jsonb) r', [turn()]);
    ok(dis.code === 'intent_disabled' && (await turnsN()) === t0 && (await aud('dalil.future_turn')) === ad0 + 1, 'dalilFutureTurn: a turn whose intent is switched off is refused (audited) and nothing is logged');
    await sw('k-admin', 'future.ai_rung', true, 'Review finished, back on');
    const st = await r('sro', 'select kafaa_dalil_future_turn($1::jsonb) r', [turn()]);
    const s1 = (await q('select * from kafaa_advisor_sessions where id = $1', [st.data?.session_id]))[0];
    const tt = await q('select * from kafaa_advisor_turns where session_id = $1 order by id', [st.data?.session_id]);
    ok(st.ok && s1?.person_id === 'p-sro' && s1.mode === 'staff' && s1.submode === 'career' && tt.length === 2 && tt.every((x) => x.intent === 'future.ai_rung.personal' && x.submode === 'career') && (await aud('dalil.career_turn')) > 0,
      'dalilFutureTurn: a staff turn is logged as a career turn (mode staff, submode career, the future intent kept) through kafaa_dalil_career_turn');
    const pp = await r('alnoor-gm', 'select kafaa_dalil_future_turn($1::jsonb) r', [turn()]);
    const pi = await r('alnoor-gm', 'select kafaa_dalil_future_turn($1::jsonb) r', [turn({ personal: false })]);
    const pub = await r('alnoor-gm', 'select kafaa_dalil_future_turn($1::jsonb) r', [turn({ personal: false, intent: 'future.skill_crosswalk.public', question: 'What is the ESCO equivalent of digital twin validation?' })]);
    const s2 = (await q('select * from kafaa_advisor_sessions where id = $1', [pub.data?.session_id]))[0];
    ok(pp.code === 'personal_not_allowed' && pi.code === 'personal_not_allowed' && pub.ok && s2?.mode === 'partner' && !s2.submode,
      'dalilFutureTurn: personal answers (flag or .personal intent) only for staff with a skills profile; a partner\'s public future answer is logged in partner mode');
    await q(`update kafaa_dalil_settings set enabled = false where id = 'global'`);
    const killed = await r('sro', 'select kafaa_dalil_future_turn($1::jsonb) r', [turn()]);
    const killedP = await r('alnoor-gm', 'select kafaa_dalil_future_turn($1::jsonb) r', [turn({ personal: false, intent: 'future.skill_crosswalk.public' })]);
    ok(killed.code === 'disabled' && killedP.code === 'disabled', 'dalilFutureTurn: the Dalil kill switch still stops future-skills turns for staff and partners');
  } finally { await db.exec('rollback'); }

  // ── grants and additivity
  let anon = 0;
  for (const sql of ["select kafaa_dalil_future_turn('{}'::jsonb)", "select kafaa_set_dalil_intent('future.ai_rung', false, 'reason here')"]) { try { await one(null, sql); } catch { anon++; } }
  let helper = 0;
  try { await one('k-admin', "select kafaa_dl_intent_base('future.x')"); } catch { helper++; }
  const anonAll = await q(`select routine_name from information_schema.routine_privileges where grantee = 'anon' and routine_name in ('kafaa_dalil_future_turn', 'kafaa_set_dalil_intent', 'kafaa_dl_intent_base')`);
  ok(anon === 2 && helper === 1 && anonAll.length === 0, 'grants: anonymous visitors execute nothing new (they keep kafaa_dalil_turn); the intent rule is internal');
  const pol = await q(`select qual from pg_policies where tablename = 'kafaa_dalil_intents' and policyname = 'kafaa_read'`);
  ok(pol.length === 1 && /SELECT kafaa_has_grant/i.test(pol[0].qual), 'RLS: the catalogue uses the per-statement policy form');
  const text = readFileSync(MIG, 'utf8');
  ok(!BANNED.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)) && !/\balter\s+table\s+(?!kafaa_)/i.test(text) && !/\balter\s+policy\s+\w+\s+on\s+(?!kafaa_)/i.test(text) && !/create or replace function kafaa_dalil_(turn|career_turn)\b/.test(text),
    'additive: the FS84 migration removes nothing (the words never appear), alters only kafaa_* objects and redefines no shared function');
  const md5 = await q(`select p.proname, md5(p.prosrc) m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('kafaa_dl_intent_base', 'kafaa_set_dalil_intent', 'kafaa_dalil_future_turn') order by 1`);
  const dg = (await q(`select count(*)::int n, left(md5(string_agg(to_jsonb(t)::text, '|' order by t.id)), 8) d from public.kafaa_dalil_intents t`))[0];
  ok(md5.length === 3, `digests: ${md5.map((x) => `${x.proname} ${x.m}`).join(', ')}; kafaa_dalil_intents ${dg.n} rows ${dg.d}`);
}

// kafaa-persona-signin (Supabase Edge Function, Deno). Lets any visitor of the Kafa'a portal sign in as one of the 14 Kafa'a-only
// demo personas (k-*), with no password anywhere in the client bundle, the repo or the request.
//
//   POST { "persona": "k-admin" }  ->  200 { ok: true, email, token_hash }
//
// The browser then exchanges token_hash for a normal Supabase session itself (POST /auth/v1/verify, type "email"), so Auth's
// per-IP limits apply to each visitor rather than to this function's shared egress IP.
//
// What it does, with the service role key that Supabase injects into every hosted Edge Function (no extra secret needed):
//   1. refuses anything that is not one of the 14 Kafa'a persona ids below (never a NEXUS demo account, never an arbitrary email);
//   2. keeps one Auth user per persona, <persona>@<KAFAA_PERSONA_EMAIL_DOMAIN> (default personas.kafaa.demo; no mail is ever sent),
//      created on first use with app_metadata.kafaa_persona = <persona>. app_metadata is writable by the service role only and is
//      carried in the JWT; kafaa_me() / kafaa_whoami() read it (migration 20261012161001_kafaa_persona_signin.sql);
//   3. generates a one-time magic-link token for that user (admin.generateLink: no email is sent) and returns its hash.
// It never touches a NEXUS auth user, a NEXUS profile row or any table.
//
// Deploy: supabase functions deploy kafaa-persona-signin --project-ref hlirqxoddysxtdezwcgv
// (JWT verification can stay on: the portal sends the public anon key as its bearer token.)
// Optional function secrets: KAFAA_PERSONA_EMAIL_DOMAIN, KAFAA_ALLOWED_ORIGINS (comma-separated; defaults below).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const PERSONAS = new Set([
  'k-student', 'k-graduate', 'k-lo-trainee', 'k-ro', 'k-instructor', 'k-licensing-coord', 'k-hr-analyst',
  'k-university', 'k-observer', 'k-editor', 'k-admin', 'k-auditor', 'k-ecp', 'k-contractor',
]);
const DOMAIN = (Deno.env.get('KAFAA_PERSONA_EMAIL_DOMAIN') || 'personas.kafaa.demo').trim().toLowerCase();
const ORIGINS = (Deno.env.get('KAFAA_ALLOWED_ORIGINS') ||
  'https://upskill.enecai.xyz,https://enec-kafaa.netlify.app,https://enecai.xyz,http://localhost:5173,http://localhost:4173')
  .split(',').map((s) => s.trim()).filter(Boolean);
const PREVIEW = /^https:\/\/[a-z0-9-]+--enec-kafaa\.netlify\.app$/; // Netlify deploy previews of the enec-kafaa site

function cors(origin: string | null): Record<string, string> {
  const allow = origin && (ORIGINS.includes(origin) || PREVIEW.test(origin)) ? origin : ORIGINS[0];
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}
function reply(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return reply({ ok: false, code: 'method_not_allowed' }, 405, h);

  let persona = '';
  try {
    persona = String(((await req.json()) as { persona?: unknown })?.persona ?? '');
  } catch {
    /* fall through to unknown_persona */
  }
  if (!PERSONAS.has(persona)) return reply({ ok: false, code: 'unknown_persona' }, 400, h);

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply({ ok: false, code: 'not_configured' }, 503, h);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `${persona}@${DOMAIN}`;

  // First use: create the persona's Auth user (confirmed, no password, persona claim in app_metadata).
  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { kafaa_persona: persona }, user_metadata: { kafaa_demo_persona: persona } });
    if (created.error && !/already|exists|registered/i.test(created.error.message)) {
      console.error('kafaa-persona-signin: createUser failed', persona, created.error.message);
      return reply({ ok: false, code: 'create_failed' }, 502, h);
    }
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) {
      console.error('kafaa-persona-signin: generateLink failed', persona, link.error.message);
      return reply({ ok: false, code: 'link_failed' }, 502, h);
    }
  }
  const user = link.data.user;
  if (user && (user.app_metadata as Record<string, unknown> | undefined)?.kafaa_persona !== persona) {
    // Make sure the claim is there before the visitor exchanges the token (the JWT is minted at that point).
    const up = await admin.auth.admin.updateUserById(user.id, { app_metadata: { kafaa_persona: persona } });
    if (up.error) {
      console.error('kafaa-persona-signin: updateUserById failed', persona, up.error.message);
      return reply({ ok: false, code: 'claim_failed' }, 502, h);
    }
  }
  const tokenHash = link.data.properties?.hashed_token;
  if (!tokenHash) return reply({ ok: false, code: 'link_failed' }, 502, h);
  return reply({ ok: true, persona, email, token_hash: tokenHash }, 200, h);
});

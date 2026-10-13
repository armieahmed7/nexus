// Assemble the Netlify publish folder: deploy_out/_redirects + deploy_out/kafaa/ (the Vite build, base /kafaa/).
// Run after `vite build` (npm run build:deploy does both). Nothing here deploys anything.
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DIST = 'dist/kafaa';
const OUT = 'deploy_out';
if (!existsSync(`${DIST}/index.html`)) {
  console.error(`make-deploy: ${DIST}/index.html missing; run the build first`);
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(DIST, `${OUT}/kafaa`, { recursive: true });
// public/_redirects is copied into the build by Vite; Netlify reads it only at the publish root.
if (existsSync(`${OUT}/kafaa/_redirects`)) renameSync(`${OUT}/kafaa/_redirects`, `${OUT}/_redirects`);
else writeFileSync(`${OUT}/_redirects`, readFileSync('public/_redirects'));

// Netlify does not publish dot-directories below the deploy root, so /kafaa/.well-known/ is never served there. Publish the issuer
// profile at the deploy root (/.well-known/kafaa-issuer.json, which Netlify does serve); _redirects rewrites /kafaa/.well-known/* to it.
if (existsSync(`${OUT}/kafaa/.well-known`)) cpSync(`${OUT}/kafaa/.well-known`, `${OUT}/.well-known`, { recursive: true });
for (const f of ['.well-known/kafaa-issuer.json', 'kafaa/issuer/kafaa-issuer.json']) {
  if (!existsSync(`${OUT}/${f}`)) {
    console.error(`make-deploy: ${OUT}/${f} is missing`);
    process.exit(1);
  }
}

// Security and cache headers (audit 2026-10-13, finding 1) live in the repo-root netlify.toml (git-linked builds read it). Check them
// against the build, and copy them into deploy_out/netlify.toml so a prebuilt zip upload is served with the same headers.
const ROOT_TOML = '../netlify.toml';
if (!existsSync(ROOT_TOML)) fail(`${ROOT_TOML} (the security headers) is missing`);
const headerBlocks = parseHeaderBlocks(readFileSync(ROOT_TOML, 'utf8'));
const builtHtml = readFileSync(`${OUT}/kafaa/index.html`, 'utf8');
checkHeaders(headerBlocks, builtHtml);

// A zip upload (Netlify MCP deploy-site) triggers a remote build: publish the folder as is, with no build command.
writeFileSync(`${OUT}/netlify.toml`, '[build]\n  publish = "."\n  command = ""\n' + headerBlocks.map((b) => `\n${b.text}`).join(''));

// robots.txt at the site root (finding 22): every page already carries <meta name="robots" content="noindex">; crawlers are asked not to
// fetch anything (that also keeps them from opening public verification links, which are rate-limited and counted).
writeFileSync(`${OUT}/robots.txt`, "# Kafa'a demo portal: not for indexing (every page is noindex).\nUser-agent: *\nDisallow: /\n");

const redirects = readFileSync(`${OUT}/_redirects`, 'utf8');
const rules = redirects.split('\n').map((l) => l.trim().replace(/\s+/g, ' '));
const SPA = '/kafaa/* /kafaa/index.html 200';
const ASSETS_404 = '/kafaa/assets/* /kafaa/asset-missing.txt 404';
for (const line of ['/ /kafaa/ 302', '/kafaa /kafaa/ 301', '/kafaa/.well-known/* /.well-known/:splat 200!', ASSETS_404, SPA]) {
  if (!rules.includes(line)) {
    console.error(`make-deploy: _redirects is missing "${line}"`);
    process.exit(1);
  }
}
// Netlify applies the first matching rule: the issuer rewrite must sit above the SPA fallback.
if (rules.indexOf('/kafaa/.well-known/* /.well-known/:splat 200!') > rules.indexOf('/kafaa/* /kafaa/index.html 200')) {
  console.error('make-deploy: the /kafaa/.well-known/* rewrite must come before the /kafaa/* SPA rule in _redirects');
  process.exit(1);
}
// A chunk of an earlier deploy must 404 (the app then reloads once, src/shell/chunkReload.ts), not fall through to the SPA rule:
// index.html served as 200 text/html for a .js chunk is rejected as a module script and the page stays broken.
if (rules.indexOf(ASSETS_404) > rules.indexOf(SPA)) {
  console.error('make-deploy: the /kafaa/assets/* 404 rule must come before the /kafaa/* SPA rule in _redirects');
  process.exit(1);
}
if (!existsSync(`${OUT}/kafaa/asset-missing.txt`)) {
  console.error(`make-deploy: ${OUT}/kafaa/asset-missing.txt (the body of the /kafaa/assets/* 404) is missing`);
  process.exit(1);
}
const html = readFileSync(`${OUT}/kafaa/index.html`, 'utf8');
if (!html.includes('/kafaa/assets/')) {
  console.error('make-deploy: index.html does not reference /kafaa/assets/ (wrong base?)');
  process.exit(1);
}
const pw = process.env.VITE_NEXUS_DEMO_PASSWORD || (existsSync('.env.local') && /^VITE_NEXUS_DEMO_PASSWORD=.+$/m.test(readFileSync('.env.local', 'utf8')));
if (!pw) console.warn('make-deploy: WARNING VITE_NEXUS_DEMO_PASSWORD was not set for this build; role-card sign-in will only work on the NEXUS origin.');
console.log(`make-deploy: ${OUT}/ ready (_redirects + netlify.toml with ${headerBlocks.length} header blocks + robots.txt + kafaa/)`);

function fail(msg) {
  console.error(`make-deploy: ${msg}`);
  process.exit(1);
}
/** [[headers]] blocks of a netlify.toml: { for, values, text }. Values are single-line "..." strings. */
function parseHeaderBlocks(toml) {
  const blocks = [];
  const lines = toml.split('\n');
  let cur = null;
  for (const line of lines) {
    if (/^\s*\[\[headers\]\]\s*$/.test(line)) { cur = { for: null, values: {}, lines: [line] }; blocks.push(cur); continue; }
    if (cur && /^\s*\[(?!headers\.values\])/.test(line)) { cur = null; continue; }
    if (!cur) continue;
    if (/^\s*(#.*)?$/.test(line)) continue;
    cur.lines.push(line);
    const m = line.match(/^\s*("?)([A-Za-z0-9-]+)\1\s*=\s*"(.*)"\s*$/);
    if (m && m[2] === 'for') cur.for = m[3];
    else if (m) cur.values[m[2]] = m[3];
  }
  return blocks.map((b) => ({ for: b.for, values: b.values, text: b.lines.join('\n') + '\n' }));
}
/** The headers the audit requires, checked against the built index.html (inline script hashes). */
function checkHeaders(blocks, html) {
  const page = blocks.find((b) => b.for === '/kafaa/*');
  const assets = blocks.find((b) => b.for === '/kafaa/assets/*');
  if (!page) fail('netlify.toml has no [[headers]] block for "/kafaa/*"');
  if (!assets || !/max-age=31536000/.test(assets.values['Cache-Control'] ?? '') || !/immutable/.test(assets.values['Cache-Control'] ?? '')) fail('netlify.toml: /kafaa/assets/* needs Cache-Control "public, max-age=31536000, immutable"');
  const v = page.values;
  const want = { 'X-Frame-Options': /^DENY$/, 'X-Content-Type-Options': /^nosniff$/, 'Referrer-Policy': /^strict-origin-when-cross-origin$/, 'Permissions-Policy': /camera=\(\)/ };
  for (const [h, re] of Object.entries(want)) if (!re.test(v[h] ?? '')) fail(`netlify.toml: /kafaa/* header ${h} is missing or wrong (${v[h] ?? 'absent'})`);
  const csp = v['Content-Security-Policy'] ?? '';
  const dir = Object.fromEntries(csp.split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const [k, ...r] = x.split(/\s+/); return [k, r]; }));
  if (!(dir['frame-ancestors'] ?? []).includes("'none'")) fail("CSP needs frame-ancestors 'none'");
  if (!(dir['connect-src'] ?? []).includes('https://hlirqxoddysxtdezwcgv.supabase.co')) fail('CSP connect-src must allow the Supabase project');
  if ((dir['script-src'] ?? []).some((x) => x === "'unsafe-inline'" || x === "'unsafe-eval'" || x === '*')) fail('CSP script-src must not allow inline or eval scripts');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  const listed = (dir['script-src'] ?? []).filter((x) => x.startsWith("'sha256-"));
  for (const h of inline) if (!listed.includes(h)) fail(`CSP script-src lacks ${h} (an inline script of index.html changed: update netlify.toml)`);
  for (const h of listed) if (!inline.includes(h)) fail(`CSP script-src lists ${h}, which matches no inline script of index.html (remove it)`);
}

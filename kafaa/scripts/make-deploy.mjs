// Assemble the Netlify publish folder: deploy_out/_redirects + deploy_out/kafaa/ (the Vite build, base /kafaa/).
// Run after `vite build` (npm run build:deploy does both). Nothing here deploys anything.
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

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

// A zip upload (Netlify MCP deploy-site) triggers a remote build: publish the folder as is, with no build command.
writeFileSync(`${OUT}/netlify.toml`, '[build]\n  publish = "."\n  command = ""\n');

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
console.log(`make-deploy: ${OUT}/ ready (_redirects + netlify.toml + kafaa/)`);

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

// A zip upload (Netlify MCP deploy-site) triggers a remote build: publish the folder as is, with no build command.
writeFileSync(`${OUT}/netlify.toml`, '[build]\n  publish = "."\n  command = ""\n');

const redirects = readFileSync(`${OUT}/_redirects`, 'utf8');
for (const line of ['/ /kafaa/ 302', '/kafaa /kafaa/ 301', '/kafaa/* /kafaa/index.html 200']) {
  if (!redirects.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).includes(line)) {
    console.error(`make-deploy: _redirects is missing "${line}"`);
    process.exit(1);
  }
}
const html = readFileSync(`${OUT}/kafaa/index.html`, 'utf8');
if (!html.includes('/kafaa/assets/')) {
  console.error('make-deploy: index.html does not reference /kafaa/assets/ (wrong base?)');
  process.exit(1);
}
const pw = process.env.VITE_NEXUS_DEMO_PASSWORD || (existsSync('.env.local') && /^VITE_NEXUS_DEMO_PASSWORD=.+$/m.test(readFileSync('.env.local', 'utf8')));
if (!pw) console.warn('make-deploy: WARNING VITE_NEXUS_DEMO_PASSWORD was not set for this build; role-card sign-in will only work on the NEXUS origin.');
console.log(`make-deploy: ${OUT}/ ready (_redirects + netlify.toml + kafaa/)`);

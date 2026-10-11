# README FIRST: Kafa'a future-skills waves E to I

You are taking over the Kafa'a future-skills programme (features FS38 to FS84, waves E, F, G, H, I) from a Claude session on another account. That session, its scratchpad and its conversation are gone for you. This folder and the source tarball are all you get.

## What you should have received

1. `kafaa-src.tgz` (or `kafaa.bundle`): the Kafa'a repository with git history (`/workspace/kafaa`, branch `master`, no remote). It excludes `node_modules`, build output and `.env.local`.
2. This folder: `README_FIRST.md`, `HANDOVER_WAVES_E_TO_I.md`, and `ref/` (plan, research, QA reports, hand-offs, deploy docs, scripts). No secrets.
3. From Armie, separately: the shared NEXUS demo password (for `.env.local` only), the Supabase connector (access to project `hlirqxoddysxtdezwcgv`) and the Netlify connector (team Mawaheb, site `enec-kafaa`).

If any of these is missing, ask Armie before you start (handover section 2 is his checklist).

## Read in this order

1. **`HANDOVER_WAVES_E_TO_I.md` sections 0 to 2** (about 15 minutes): status, what Kafa'a is, what is live, what waves A to D built, access, deploy procedure, Step 0.
2. **Handover section 3** (conventions) and then **`CONTRACT.md` in the repo**, sections 1 to 10 plus the changelog entries for FS wave A (FS01) and FS wave D. CONTRACT is the engineering contract; the handover condenses it and adds what was learned since.
3. **Handover section 5** (the process, the three prompts, the lessons learned) and **section 6** (open issues).
4. **Handover section 4, the wave you are about to run**: slots, hand-offs, QA checklist and the feature cards with their adjustments. Read the next wave only when you get to it.
5. Reference, as needed: `ref/PLAN.md` (sections 1, 2, 5, 7, 8), `ref/research/*.md` (benchmark facts with URLs; the only allowed source for figures), `ref/handoffs/fsDe*_DONE.md` (best examples of a finished engineer hand-off), `ref/QA_C.md` (best example of a wave QA report), `ref/deploy/DEPLOY_DONE.md` (what a verified deploy looks like).
6. **Section 7** before you finish each wave and at the very end (definition of done, final report template).

## Then do this

1. Step 0 (handover 2.9): unpack, install, quick gates, confirm wave D is merged, applied live and deployed. If not, finish wave D first.
2. Run wave E (five engineers in parallel, then one integration lead), ask Armie for "deploy", deploy, report. Repeat for F, G, H, I.
3. Keep Armie informed in short updates: what is done, what is running, what is next, what you need from him.

## Never

- Change anything in the `enec-nexus` Netlify site or `enecai.xyz`.
- Run DROP, DELETE, TRUNCATE or ALTER on anything that is not `kafaa_*`, or delete live rows at all.
- Commit, echo or write the demo password, a Netlify proxy URL or any token.
- Deploy without Armie's explicit go-ahead in your own session.
- Use real people's names or photos, claim regulatory authority, or type benchmark figures into copy.

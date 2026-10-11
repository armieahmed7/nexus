# Kafa'a on ENEC NEXUS: deploy plan

Investigated 8 Oct 2026, read-only. Nothing was deployed, created or changed. No pasted token was used.

## Fixed facts

| Item | Value |
|---|---|
| Site | `enec-nexus`, id `69afeda6-b3fd-4de8-8173-af9fe3ba3327` |
| Domains | `enecai.xyz` (primary) and `enec-nexus.netlify.app` |
| Plan | `nf_team_dev` |
| Git link | none |
| Published deploy | `6abece0c8021c4c58397f533`, context production, `deploy_source: api`, built remotely from an uploaded zip (`has_source_zip: true`) |
| Deploy permalink | https://6abece0c8021c4c58397f533--enec-nexus.netlify.app |

The 4 functions are v2, nodejs24.x, us-east-2, bootstrap 2.18.0, with in-code paths:

| Function | Path | Digest (sha256) |
|---|---|---|
| adsb | `/api/adsb` | `4e929b22162f86d9960ad7fd76ecda2c4b60de92f8b1517fdfb8d460cac937b0` |
| celestrak | `/api/celestrak` | `5098ab3c41fc1940bb5b045518de79de8f5db1f95e84c64d59a4d98097cdb076` |
| hls | `/api/hls` | `f42b05eda0c74b8b498608d8cd41abf1a9175854e24880c750b0931a8aa2c699` |
| news | `/api/news` | `30a487c50b7ca7d96daac0bdf266e96bd80a7bcfc050eb68c3fc3614166c6266` |

Live behaviour today:
- `/api/news` returns 200 JSON.
- `/api/adsb` returns 400 JSON without parameters, so the function is alive.
- `/kafaa/` returns 200 with the NEXUS `index.html`, because the SPA catch-all `/* /index.html 200` serves it.

## 1. What the Netlify MCP can and cannot do

I read the tool list and also the bundled source of `@netlify/mcp@1.18.0` (`dist/netlify-mcp.js`, downloaded with `npm pack`).

| Tool / operation | Params | Relevant capability |
|---|---|---|
| `netlify-deploy-services-reader` / `get-deploy` | deployId | Reads deploy JSON. |
| `netlify-deploy-services-reader` / `get-deploy-for-site` | siteId, deployId | Same as `get-deploy`, scoped to a site. |
| `netlify-deploy-services-updater` / `deploy-site` | siteId | Returns a shell command (see below). It does not deploy by itself. |
| `netlify-project-services-reader` / `get-project`, `get-projects`, `get-forms-for-project` | siteId / name search / teamSlug | Site metadata. |
| `netlify-project-services-updater` / `create-new-project` | name, teamSlug | Creates an empty site. If the name is taken, it picks a similar one. |
| `netlify-project-services-updater` / `manage-env-vars`, `update-project-name`, `update-forms`, `update-visitor-access-controls`, `manage-form-submissions` | | Not deploy-related. |
| team / user / extension readers, `get-netlify-coding-context` | | Docs and metadata only. |

What the deploy JSON gives:
- **Functions:** name, sha256 digest, routes, function id, runtime and size.
- **Not included:** the file list with sha1 values, any way to download a function bundle, and any way to download the source zip.

**`deploy-site` in detail:**
- The tool mints a **30-minute JWE proxy token**, which is a credential, so never paste it into chat or into worker prompts.
- That token allows only two calls: `POST /api/v1/sites/{id}/builds` and `GET /api/v1/deploys/:id`.
- It returns the command `npx -y @netlify/mcp@latest --site-id <id> --proxy-path "<proxy url>"`.
- The command zips the current directory, skipping `node_modules`, `.git`, `.netlify`, `.env`, `coverage`, `tmp` and `deploy-*.zip`.
- It POSTs the zip to `/builds`. Netlify then runs a **full remote build**, including bundling functions from `netlify/functions` or the configured functions directory, and **publishes to production**. This is how `6abece0c` was made.
- Both `api.netlify.com` and the MCP proxy host are reachable from this container.

Capability by capability:

| Capability | Available? |
|---|---|
| Read the file list with sha1 values | **No.** `nexus_live/file_manifest_sha1.txt` (207 files from served bytes) is the only substitute. |
| Read function sha256 digests | Yes, via `get-deploy-for-site`. |
| Download the stored source zip | **No** tool can. Only the Netlify UI can, on the deploy detail page. |
| Download deployed function bundles | **No.** No tool or endpoint for this is exposed. |
| File-digest deploy that re-uses existing files and function digests | **No.** The proxy token cannot call `POST /sites/{id}/deploys`, and there is no personal token. |
| Upload a zip that carries the functions forward | Only by including the function **source** in the zip so the remote build bundles it again. We do not have it. (A remote build should also pass through pre-zipped function archives, but we cannot get the archives either.) |
| Draft or unpublished deploy | **No** draft flag. The builds endpoint publishes to production. |
| Roll back or restore a deploy | **No** tool. The MCP's own deploy guidance also tells agents not to restore. Rollback is a dashboard action for Armie (see section 4). |
| Change redirects or proxy rules without a redeploy | **No.** `_redirects` and `netlify.toml` rules belong to each deploy, and no API changes them in place. |
| Create a new site | Yes, via `create-new-project`. |

Other routes I checked:
- **GitHub.** The repo `armieahmed7/autonomous-enec` is not reachable: `check_repo_access` returned not_found_or_no_access, and `list_repos` finds nothing named "enec".
- **Source owner.** The #claudetag session that owns the source (thread `C0BEJ3U5U4Q` / `1790708826.231889`, last deploy 1 Oct 21:19Z) has no session id exposed to this session.

## 2. Separate site `enec-kafaa` plus a proxy rewrite on `enec-nexus`

- **The separate site touches nothing on `enec-nexus`.** It is created with `create-new-project`, and Kafa'a is deployed there with `deploy-site`, which is a full publish on that site only.
  - Kafa'a works on its own at `https://enec-kafaa.netlify.app/kafaa/`.
  - It runs on a different origin, so it **cannot** read the NEXUS session from localStorage. Users sign in again with the same Supabase project and the same demo credentials.
- **The proxy rewrite, `/kafaa/* https://<kafaa-site>/kafaa/:splat 200`, still needs one new deploy of `enec-nexus`.** Redirect rules cannot be added out of band. So it does **not** avoid the function problem; it only shrinks it to one deploy.
  - **Payoff:** after that single deploy, every later Kafa'a release goes only to `enec-kafaa` and never touches `enec-nexus` or its functions again.
  - **Same origin:** the proxied pages are served from the `enecai.xyz` origin, so the shared localStorage session works.
  - **Rule order** for `enec-nexus` `_redirects` (first match wins):
    ```
    /kafaa      /kafaa/                                    301
    /kafaa/*    https://enec-kafaa.netlify.app/kafaa/:splat 200
    /*          /index.html                                200
    ```
  - **Kafa'a build:** use Vite `base: "/kafaa/"`, `BrowserRouter basename="/kafaa"`, and its own `_redirects` line `/kafaa/* /kafaa/index.html 200`.
  - **Root redirect on `enec-kafaa`:** optionally add `/ /kafaa/ 302` so its bare URL works.

## 3. Can a new `enec-nexus` deploy from the mirror carry the functions forward?

**No, not from this environment as things stand.**
- A `deploy-site` zip of `nexus_live` plus `/kafaa` plus `_redirects` would publish a deploy with **zero functions**. `/api/news`, `/api/adsb`, `/api/celestrak` and `/api/hls` would then fall through to the SPA `index.html`, which breaks the Newsroom/Home news feed and the Site View feeds.
- Netlify will not "keep" the old functions: every deploy is an atomic snapshot.
- The function bundles cannot be downloaded through any tool available here.

**What would unblock it is the source of the original upload**, in any one of these forms:
- **A. Netlify UI (Armie, about 1 minute).** Deploys, then `6abece0c`, then download the **source zip**. This is the exact zip that produced the live deploy. Attach it in Slack.
  - As a backup for rollback, also use **Download, Download ready** to get the deploy output.
- **B. The #claudetag session**, which holds the project including `netlify/functions/*` and `netlify.toml`. Armie can ask it to share the project zip, or have it run the deploy with `/kafaa` added.
- **C. GitHub.** If `autonomous-enec` was pushed, Armie grants the Claude GitHub App access to it, or reconnects GitHub, and we pull `netlify/functions` from the repo.
- **D. Last resort: re-implement the 4 functions** from the front-end call sites and the live responses. Fidelity is uncertain, so test on the locked deploy (section 4) against the live endpoints. Not recommended.

## 4. Testing before publish, and rollback

- **No draft through the MCP.** The safe substitute is that Armie **locks the current published deploy** in the Netlify UI: Deploys, then "Lock to stop auto publishing".
  - While it is locked, a new build still runs to `ready` but is **not published**.
  - We test it at its permalink `https://<newDeployId>--enec-nexus.netlify.app`, then Armie clicks **Publish deploy** and unlocks.
  - Confirm the lock held: `get-deploy-for-site` should show `published_at: null` for the new deploy, and `enecai.xyz` should still serve `index.html` sha1 `db9a819e…`.
- **The `enec-kafaa` site itself is the staging area for Kafa'a.** Deploying there has no effect on `enec-nexus`.
- **Rollback (Armie, dashboard):** Deploys, then `6abece0c8021c4c58397f533`, then **Publish deploy**.
  - This is atomic and instant, and it brings back that deploy's own 4 functions and redirects.
  - No MCP tool can do this, so Armie has to be available during the publish window.
- **Retention:** on this plan, non-published deploys are auto-deleted after about 30 days. Once a new deploy is published, `6abece0c` stays restorable only until about 31 Oct 2026. Download its source zip and output zip first.

## Recommended procedure

### Phase 1: now, zero risk to `enec-nexus`
1. `create-new-project` with name `enec-kafaa` in Armie's team. Record the returned site id and name, since the name may differ.
2. Build Kafa'a with Vite `base: "/kafaa/"`. Put the output under `deploy_dir/kafaa/`, plus `deploy_dir/_redirects`:
   ```
   / /kafaa/ 302
   /kafaa/* /kafaa/index.html 200
   ```
   Add a `netlify.toml` with `[build] publish = "."` and no build command, so the remote build only publishes the files.
3. Call `deploy-site` with the `enec-kafaa` site id, then run the returned `npx -y @netlify/mcp@latest --site-id … --proxy-path …` from `deploy_dir`. Do not echo the proxy URL in reports.
4. Verify:
   - `https://enec-kafaa.netlify.app/kafaa/` and its deep links load.
   - Supabase sign-in works with the demo personas.
   - `get-deploy-for-site` shows state `ready`.
5. Re-check that `enec-nexus` is untouched: published deploy is still `6abece0c`, and `/api/news` returns 200.

At the end of Phase 1, Kafa'a is live and usable standalone with a separate sign-in.

### Phase 2: mount at `enecai.xyz/kafaa/`, needs the function source
6. **Get the source** through 3A, 3B or 3C. Unzip it into a fresh directory and inspect it:
   - Confirm that `netlify.toml` and `netlify/functions/{adsb,celestrak,hls,news}` are present.
   - Check the build command and publish dir. The live `dist/` is hand-patched, so make sure the build does not regenerate it from `src`.
   - Before uploading, build or copy locally and compare the publish-dir sha1 values with `nexus_live/file_manifest_sha1.txt`. All 207 must match.
7. **Make the change.**
   - Add the three `_redirects` lines from section 2 (proxy to `enec-kafaa`) above the `/*` rule.
   - Add the small Kafa'a launcher to `index.html` if wanted. If `index.html` changes, the sha1 check excludes that one file.
   - Do not touch the functions.
8. **Armie locks** the published deploy in the Netlify UI, and downloads the source and output zips of `6abece0c` as backups.
9. **Deploy:** call `deploy-site` with siteId `69afeda6-…`, and run the command from the unzipped source directory.
10. **Test on the permalink** of the new (locked, unpublished) deploy:
    - `get-deploy-for-site` shows `ready`, `available_functions` lists all 4 with the `/api/*` routes, the summary says "4 functions deployed", and the redirect rule count is 3.
    - `/api/news` returns 200 JSON, `/api/adsb` returns 400 JSON, and `/api/celestrak` and `/api/hls` return JSON, not HTML.
    - The 207 mirrored paths match by sha1.
    - `/kafaa/` and `/kafaa/<deep-link>` serve Kafa'a, and `/` plus a few NEXUS routes still serve NEXUS.
    - Sign in to NEXUS, then open `/kafaa/` and confirm the session is shared.
11. **Publish.** Armie clicks Publish deploy on the new deploy and unlocks. Re-run the checks from step 10 on `https://enecai.xyz`.
12. **Rollback** if anything fails after publishing: Armie publishes `6abece0c8021c4c58397f533` from the Deploys list. If the problem is only in Kafa'a, redeploy `enec-kafaa` instead, which leaves `enec-nexus` alone.

From then on, every Kafa'a update goes through Phase 1, step 3, against `enec-kafaa` only.

### Never
- Never run `deploy-site` for `enec-nexus` from a mirror-only folder, or from any folder without `netlify/functions`. Doing so drops the 4 functions.
- Never use or forward the Netlify token pasted on 29 Sep.

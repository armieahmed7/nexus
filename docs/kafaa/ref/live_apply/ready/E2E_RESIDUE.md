# E2E test residue on the live demo database (read-only listing, 2026-10-13 21:45 UTC)

The live E2E journeys (`kafaa/tests/e2e/*.spec.ts`) wrote these rows through the real RPCs between 8 and 10 October. They are **not**
removed by this bundle: removing them is a data change for the owner to decide (a guarded clean-up in the style of `cleanup/01` and
`cleanup/03` would cancel or delete them and keep `kafaa_audit_events` as history). From this PR on, a journey that signs in to write
refuses to run against `hlirqxoddysxtdezwcgv` unless `KAFAA_E2E_LIVE_WRITES=1` is set on purpose (`tests/e2e/helpers.ts`,
`assertWritableTarget`), so no new rows appear.

Rows whose JSON text contains "E2E" (`kafaa_audit_events` and `kafaa_xapi_statements` left out: append-only history): **107 rows in 15 tables**.

| table | rows | ids |
|---|---|---|
| kafaa_notifications | 23 | `nt-oa-{1c9e9720…,3cffe12b…,7912c281…,b43c45a4…,dbe491b1…}-{applied,released,selected}`, `nt-oa-50b7a259…-applied`, `nt-rr-{05c0a443…,16cfa4af…,1f67b83a…,3815196d…,39e48afb…,68c9a50f…,dffff11d…}-open` (unread, for p-head-sq, p-training-mgr, p-qc-inspector, p-outage-manager) |
| kafaa_sessions | 14 | `ses-11b9fda4f91343b6 ses-1235aacadbd14656 ses-1cbc04302f644fb5 ses-288cc245821f4391 ses-6a950b9853f04577 ses-6ddd3f6237d64401 ses-70d7a2e120eb4838 ses-76efd636ace0412d ses-8eb7d3cb1156402e ses-9006a95bc5674120 ses-9315f797e0f34002 ses-9b5c96cb988445ca ses-a286178128164be1 ses-e56a628ef24f4771` ("E2E-QA room …") |
| kafaa_engine_changes | 12 | `ec:match:002` … `ec:match:013` (weights changed and restored; history, they net out) |
| kafaa_enrolments | 11 | seed rows `en-77 en-80 en-84 en-87 en-99 en-107 en-113` completed with "E2E-QA evidence"; `en-110`, `en-7cc64d9f…`, `en-89f55803…` cancelled; `en-ea556b3c…` (p-qc-inspector) completed |
| kafaa_evaluation_acks | 8 | `ack-0bf2f59e… ack-2efb98a7… ack-36486a90… ack-8974373c… ack-8bce342d… ack-ecec0485… ack-ee0402b1… ack-f9bf54ca…` (w-ro-01, qr-w-ro-01-qs-ro) |
| kafaa_reserve_requests | 7 | `rr-05c0a443… rr-16cfa4af… rr-1f67b83a… rr-3815196d… rr-39e48afb… rr-68c9a50f… rr-dffff11d…` (closed) |
| kafaa_opportunities | 7 | `opp-0fe468d7… opp-1a880343… opp-1a88f9d1… opp-25582c28… opp-3a743be4… opp-72993aa6… opp-b9adec9b…` ("E2E-QA outage walkdown support", listed) |
| kafaa_ojt_logs | 6 | `ojt-03c05c35b4c44080 ojt-37b741a654eb4d55 ojt-3ba0a584c08b48c6 ojt-5eaa96b91c9a4534 ojt-a4ab7b74a06240b4 ojt-eb9d36e6f91b4731` (p-qc-inspector) |
| kafaa_opportunity_applications | 6 | `oa-1c9e9720… oa-3cffe12b… oa-50b7a259… oa-7912c281… oa-b43c45a4… oa-dbe491b1…` (p-qc-inspector) |
| kafaa_career_conversations | 5 | `cc-p-qc-inspector-2026-h2-1` (seed row, notes edited), `cc-062f0886fa054471 cc-20041f87575e42e5 cc-7f47d326cef44af3 cc-d427f58d4e54427e` |
| kafaa_sat_changes | 4 | `sc-041889b3c0334f43 sc-a44c163d10f04731 sc-ae4ad485711a45af sc-ed1e78392e194264` (jt-qs-ro-t4) |
| kafaa_skill_ratings | 1 | `skr:chk-s-nse:p-buyer:sk-da-01-analysis` (example text) |
| kafaa_alumni | 1 | `alm:p-nse` (headline, withdrawn) |
| kafaa_rotation_placements | 1 | `rp-gdp25-p-rao-3` (outcome note) |
| kafaa_microcred_awards | 1 | `mca-p-sro-mc-project-req` (decision note) |

Linked rows without the marker:

| table | rows | note |
|---|---|---|
| kafaa_enrolments | 4 | **open** test enrolments for p-outage-planner: `en-4d65301dbf664280a34d68732c3b9ec9` c-rp-init requested, `en-555587b59a044f0c8928481d1940235e` c-intilaqa requested, `en-67ff81de36a54ec59039764e0a1d0432` c-crucial requested, `en-5f49a6378f19481bb3eb49a9c7b4f691` c-rp-cont enrolled (they appear in approval queues) |
| kafaa_plan_activities | 4 | `pa-cc-cc-{062f0886fa054471,20041f87575e42e5,7f47d326cef44af3,d427f58d4e54427e}-a1` (from the E2E conversations, plan dp-rm-rm-qc-procurement) |
| kafaa_training_records | 8 | `tr-0afc9b25… tr-456fbaaa… tr-4b0c80ec… tr-780c2c6c… tr-8c488c9a… tr-b03da869… tr-c11485a4… tr-da4aaf5f…` (the completed E2E sessions) |
| kafaa_attempts | 8 | generated ids for the same 8 people |
| kafaa_skill_evidence | 64 | evidence rows pointing at those training records and attempts |
| kafaa_data_requests | 6 | `dat-0fe301ead6ff458a dat-198be699f76c44a9 dat-2b5af58495b54aa6 dat-d29ec59b535d4a68 dat-e78df126b96043ed dat-f6fb8d802feb4732` (p-nse self-service exports, closed) |

Query used (read-only): for every `kafaa_*` base table except the two history tables,
`select count(*) from <table> x where to_jsonb(x)::text like '%E2E%'`; the unmarked rows by their generated ids.

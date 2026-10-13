-- kafaa_cleanup_e2e_applications (3/4) · data clean-up 2026-10-13: remove the 15 withdrawn applications the end-to-end journeys left live
-- Apply with apply_migration name "kafaa_cleanup_e2e_applications", in ORDER.txt order.
-- tests/e2e/journeys.spec.ts submits and then withdraws applications as p-nse (Graduate Plant Operator, gpo) and p-buyer (Energy
-- Pioneers) on every run; kafaa_submit_application() names them 'app-' || 32 hex digits, unlike the seed ids (app-<n>, app-p<nnn>).
-- They inflate the withdrawn cells of kafaa_application_funnel() (gpo/withdrawn 9 vs seed 0; energy-pioneers/withdrawn 7 vs seed 1).
-- Every reference was searched on 2026-10-13 (all text/json columns of every kafaa_* table): only kafaa_application_events (37 rows,
-- FK application_id) and kafaa_audit_events (37 rows: application.submit 15, application.withdraw 15, application.decide 7).
-- No skill evidence, notification or xAPI row refers to them. This part deletes the 37 events and the 15 applications. The audit rows
-- are an append-only hash chain and stay as history. Neither table has a delete trigger; the only FK into kafaa_applications is the
-- events one (deferred, no cascade). The guard stops the part unless exactly these rows match.
do $c$
declare ids text[] := array[
  'app-33f74c0c9cc64062bf480e3877d7dec5', 'app-d78c8bee33954fc6b8e065df50a4f4c2', 'app-a22f557c493048f7bd2610f1298c61dd',
  'app-3e024bb2c55148229e80da98ad356d20', 'app-394e054b2732417587844ee34891daed', 'app-22d4ea0859e04774b75e2d84afa2b5b9',
  'app-9ec952fc30c94884b850cb6ccb996c87', 'app-7187b60d9388473983e141e32e19d7ea', 'app-f4aae371fe2a4f6286c93539abe7d5a2',
  'app-9d3b21a2f2414eea988a26e763b87079', 'app-6988b8f18a9b4351b437eafc52cf0669', 'app-99b92dc594694a1bb5e5438beba997c4',
  'app-80f358ec2fc64694836b6852f67d5773', 'app-087229b5f9264f3aa3f410a45304b309', 'app-87a8ecf6831e476aa14163bd25c7e243'];
  n integer; ev integer; gpo integer; ep integer;
begin
  select count(*) into n from kafaa_applications where id = any(ids);
  if n = 0 and not exists (select 1 from kafaa_application_events where application_id = any(ids)) then raise notice 'already applied'; return; end if;
  -- guard: all 15 are journey rows (uuid ids), withdrawn, from the two test personas, and they are all such rows on live
  select count(*), count(*) filter (where programme_id = 'gpo' and person_id = 'p-nse'), count(*) filter (where programme_id = 'energy-pioneers' and person_id = 'p-buyer')
    into n, gpo, ep
    from kafaa_applications where id = any(ids) and id ~ '^app-[0-9a-f]{32}$' and stage = 'withdrawn' and decision = 'withdrawn';
  if n <> 15 or gpo <> 9 or ep <> 6 then raise exception 'cleanup 03: expected 15 withdrawn journey applications (gpo 9, energy-pioneers 6), found % (% / %)', n, gpo, ep; end if;
  select count(*) into ev from kafaa_application_events where application_id = any(ids);
  if ev <> 37 then raise exception 'cleanup 03: expected 37 application events, found %', ev; end if;
  delete from kafaa_application_events where application_id = any(ids);
  get diagnostics n = row_count;
  if n <> 37 then raise exception 'cleanup 03: deleted % events, expected 37', n; end if;
  delete from kafaa_applications where id = any(ids);
  get diagnostics n = row_count;
  if n <> 15 then raise exception 'cleanup 03: deleted % applications, expected 15', n; end if;
end $c$;

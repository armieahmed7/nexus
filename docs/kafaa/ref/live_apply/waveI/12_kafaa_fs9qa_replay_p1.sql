-- kafaa_fs9qa_replay_p1 (1/1) · guarded refreshes after the seed rows
-- Apply with apply_migration name "kafaa_fs9qa_replay_p1". Additive and idempotent; kafaa_* objects only.
-- kafaa_skills_apply for the 15 people whose evidence the wave changed (recorded wave evidence: external_certs, automations),
-- on the demo day 2026-10-08, after the final shared redefinition and the seed rows are in. Recomputes derived states only;
-- recorded evidence is kept. Compare the person_skills digest below afterwards.
do $$ declare x text; begin
  foreach x in array array['p-buyer', 'p-cap-coord', 'p-k-instructor', 'p-k-ro', 'p-nse', 'p-outage-planner', 'p-sro', 'w-chem-01', 'w-corp-01', 'w-eng-01', 'w-instr-01', 'w-qa-01', 'w-ro-01', 'w-rp-01', 'w-sro-01']::text[] loop
    if exists (select 1 from kafaa_people where id = x) then perform kafaa_skills_apply(x, date '2026-10-08'); end if;
  end loop;
end $$;


-- kafaa_fs6qa_replay_p1 (1/1) · guarded refreshes after the seed rows
-- Apply with apply_migration name "kafaa_fs6qa_replay_p1". Additive and idempotent; kafaa_* objects only.
-- kafaa_skills_apply for the 13 people whose evidence the wave changed (recorded wave evidence: roleplay_sessions),
-- on the demo day 2026-10-08, after the final shared redefinition and the seed rows are in. Recomputes derived states only;
-- recorded evidence is kept. Compare the person_skills digest below afterwards.
do $$ declare x text; begin
  foreach x in array array['p-ai-governance', 'p-cap-chair', 'p-cap-coord', 'p-dra', 'p-incident-commander', 'p-k-hr-analyst', 'p-k-ro', 'p-qc-inspector', 'p-sq-lead', 'w-cyb-01', 'w-mnt-03', 'w-rp-03', 'w-sro-04']::text[] loop
    if exists (select 1 from kafaa_people where id = x) then perform kafaa_skills_apply(x, date '2026-10-08'); end if;
  end loop;
end $$;


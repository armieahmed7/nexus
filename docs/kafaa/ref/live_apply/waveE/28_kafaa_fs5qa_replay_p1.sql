-- kafaa_fs5qa_replay_p1 (1/1) · guarded refreshes after the seed rows
-- Apply with apply_migration name "kafaa_fs5qa_replay_p1". Additive and idempotent; kafaa_* objects only.
-- kafaa_skills_apply for the 26 people whose evidence the wave changed (recorded wave evidence: plant_visits, twin_attempts, lectures, knowledge_assets),
-- on the demo day 2026-10-08, after the final shared redefinition and the seed rows are in. Recomputes derived states only;
-- recorded evidence is kept. Compare the person_skills digest below afterwards.
do $$ declare x text; begin
  foreach x in array array['p-buyer', 'p-nse', 'p-qc-inspector', 'p-sme-reviewer', 'w-chem-01', 'w-chem-02', 'w-chem-03', 'w-eng-01', 'w-eng-02', 'w-eng-03', 'w-eng-05', 'w-mnt-01', 'w-mnt-02', 'w-mnt-03', 'w-mnt-04', 'w-mnt-05', 'w-mnt-06', 'w-mnt-07', 'w-qa-01', 'w-qa-02', 'w-rp-01', 'w-rp-02', 'w-rp-03', 'w-rp-04', 'w-ss-01', 'w-ss-02']::text[] loop
    if exists (select 1 from kafaa_people where id = x) then perform kafaa_skills_apply(x, date '2026-10-08'); end if;
  end loop;
end $$;


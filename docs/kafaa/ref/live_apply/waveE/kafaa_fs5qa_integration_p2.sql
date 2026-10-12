-- live apply part kafaa_fs5qa_integration_p2 (from supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql: the additive FS48 update of the mentoring engine card)
-- A top-level UPDATE of an existing live row: the Supabase tool asks a person to confirm it.
-- ───────────── F24 mentoring engine card: FS48 additions on top of the current version (guarded; no-op once rankCircles is listed)
update kafaa_engine_cards c set
  scoring_functions = c.scoring_functions || array(select f from unnest(array['src/modules/m22/future.ts#rankCircles', 'src/modules/m22/future.ts#rankOffers']::text[]) f
                                                   where not (f = any(c.scoring_functions))),
  inputs_used = case when exists (select 1 from jsonb_array_elements(c.inputs_used) x where x ->> 'key' = 'wfn_participants') then c.inputs_used
    else c.inputs_used || '[{"key":"wfn_participants","en":"Women in future nuclear skills (opt-in only): the future-skill areas and ways to take part I chose, circle seats and open offers","ar":"المرأة في المهارات النووية المستقبلية (بالاختيار فقط): مجالات المهارات المستقبلية وطرق المشاركة التي اخترتها، ومقاعد الحلقات والعروض المفتوحة"}]'::jsonb end,
  limitations_en = case when position('(FS48)' in c.limitations_en) > 0 then c.limitations_en
    else rtrim(c.limitations_en) || ' Mentor circles and offers (FS48) are ranked only for people who opt in, from the areas they chose; withdrawing removes them from every ranking.' end,
  limitations_ar = case when position('(FS48)' in c.limitations_ar) > 0 then c.limitations_ar
    else rtrim(c.limitations_ar) || ' تُرتَّب حلقات الإرشاد والعروض (FS48) لمن اختار المشاركة فقط ووفق المجالات التي اختارها، والانسحاب يزيله من كل ترتيب.' end,
  version = c.version + 1,
  last_changed_at = '2026-10-11T00:00:00Z'::timestamptz
where c.id = 'mentoring' and not ('src/modules/m22/future.ts#rankCircles' = any(c.scoring_functions));

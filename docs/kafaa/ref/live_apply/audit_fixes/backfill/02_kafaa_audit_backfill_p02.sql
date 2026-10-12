-- kafaa_audit_backfill_p02 (2/7) · audit 2026-10-12 back-fill: kafaa_consents rows cn-app-p161..cn-app-p208 (48), copied verbatim from kafaa/supabase/seed.sql (main)
-- Apply with apply_migration name "kafaa_audit_backfill_p02", in file order. Insert-only (on conflict (id) do nothing); existing rows are never touched. kafaa_* objects only.
select set_config('kafaa.seeding', 'on', true);
insert into kafaa_consents (id, person_id, type, purpose, version, granted_at, withdrawn_at) values
('cn-app-p161', 'ap-161', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-20T08:00:00Z', null),
('cn-app-p162', 'ap-162', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-21T08:00:00Z', null),
('cn-app-p163', 'ap-163', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-22T08:00:00Z', null),
('cn-app-p164', 'ap-164', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-23T08:00:00Z', null),
('cn-app-p165', 'ap-165', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-24T08:00:00Z', null),
('cn-app-p166', 'ap-166', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-25T08:00:00Z', null),
('cn-app-p167', 'ap-167', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-26T08:00:00Z', null),
('cn-app-p168', 'ap-168', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-27T08:00:00Z', null),
('cn-app-p169', 'ap-169', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-28T08:00:00Z', null),
('cn-app-p170', 'ap-170', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-29T08:00:00Z', null),
('cn-app-p171', 'ap-171', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-30T08:00:00Z', null),
('cn-app-p172', 'ap-172', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-08-31T08:00:00Z', null),
('cn-app-p173', 'ap-173', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-09-01T08:00:00Z', null),
('cn-app-p174', 'ap-174', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-09-02T08:00:00Z', null),
('cn-app-p175', 'ap-175', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-09-03T08:00:00Z', null),
('cn-app-p176', 'ap-176', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-09-04T08:00:00Z', null),
('cn-app-p177', 'ap-177', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-09-05T08:00:00Z', null),
('cn-app-p178', 'ap-178', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-09-06T08:00:00Z', null),
('cn-app-p179', 'ap-179', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-09-07T08:00:00Z', null),
('cn-app-p180', 'ap-180', 'application', 'Process my application to energy-pioneers; delete if unsuccessful on the published schedule', '1', '2026-06-10T08:00:00Z', null),
('cn-app-p181', 'ap-181', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-11T08:00:00Z', null),
('cn-app-p182', 'ap-182', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-12T08:00:00Z', null),
('cn-app-p183', 'ap-183', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-13T08:00:00Z', null),
('cn-app-p184', 'ap-184', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-14T08:00:00Z', null),
('cn-app-p185', 'ap-185', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-15T08:00:00Z', null),
('cn-app-p186', 'ap-186', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-16T08:00:00Z', null),
('cn-app-p187', 'ap-187', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-17T08:00:00Z', null),
('cn-app-p188', 'ap-188', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-18T08:00:00Z', null),
('cn-app-p189', 'ap-189', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-19T08:00:00Z', null),
('cn-app-p190', 'ap-190', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-20T08:00:00Z', null),
('cn-app-p191', 'ap-191', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-21T08:00:00Z', null),
('cn-app-p192', 'ap-192', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-22T08:00:00Z', null),
('cn-app-p193', 'ap-193', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-23T08:00:00Z', null),
('cn-app-p194', 'ap-194', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-24T08:00:00Z', null),
('cn-app-p195', 'ap-195', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-25T08:00:00Z', null),
('cn-app-p196', 'ap-196', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-26T08:00:00Z', null),
('cn-app-p197', 'ap-197', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-27T08:00:00Z', null),
('cn-app-p198', 'ap-198', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-28T08:00:00Z', null),
('cn-app-p199', 'ap-199', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-29T08:00:00Z', null),
('cn-app-p200', 'ap-200', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-06-30T08:00:00Z', null),
('cn-app-p201', 'ap-201', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-01T08:00:00Z', null),
('cn-app-p202', 'ap-202', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-02T08:00:00Z', null),
('cn-app-p203', 'ap-203', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-03T08:00:00Z', null),
('cn-app-p204', 'ap-204', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-04T08:00:00Z', null),
('cn-app-p205', 'ap-205', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-05T08:00:00Z', null),
('cn-app-p206', 'ap-206', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-06T08:00:00Z', null),
('cn-app-p207', 'ap-207', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-07T08:00:00Z', null),
('cn-app-p208', 'ap-208', 'application', 'Process my application to mustaqbali; delete if unsuccessful on the published schedule', '1', '2026-07-08T08:00:00Z', null)
on conflict (id) do nothing;
-- live transcription check: the rows this part inserted equal the bundle rows (count and digest); if any id already existed live the count differs and the part rolls back
do $g$ declare n integer; d text; begin
  perform set_config('TimeZone', 'UTC', true);
  select count(*)::int, left(md5(coalesce(string_agg((jsonb_build_object('id', t.id, 'person_id', t.person_id, 'type', t.type, 'purpose', t.purpose, 'version', t.version, 'granted_at', t.granted_at, 'withdrawn_at', t.withdrawn_at))::text, '|' order by t.id collate "C"), '')), 16) into n, d from kafaa_consents t where t.xmin::text = (txid_current() % 4294967296)::text;
  if n is distinct from 48 or d is distinct from '79c2b6364f24d2e7' then raise exception 'live transcription check failed for kafaa_consents: % %', n, d; end if;
end $g$;

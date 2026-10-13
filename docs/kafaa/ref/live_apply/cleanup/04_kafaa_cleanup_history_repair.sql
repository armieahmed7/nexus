-- kafaa_cleanup_history_repair (4/4) · data clean-up 2026-10-13: record the 12 files run by hand in the migration history
-- Apply with apply_migration name "kafaa_cleanup_history_repair", in ORDER.txt order.
-- docs/kafaa/ref/live_apply/audit_fixes/01-05 and audit_fixes/backfill/01-07 (PR #5, branch audit-fixes head fdb5985) were run by hand in
-- the Supabase SQL editor on 2026-10-12 about 23:00-23:14 UTC, because apply_migration was refused at the time, so
-- supabase_migrations.schema_migrations has no row for them. Their effects were checked live on 2026-10-13 (back-fill counts 208/208/468,
-- contact-form policy and certificate rate limit in place). This adds one row per file, in ORDER.txt order, with versions
-- 20261012230001..20261012230012 and the apply_migration name each file asks for. statements holds a pointer to the repo file and its
-- sha256 (the files themselves stay in the repo), not the SQL text. on conflict (version) do nothing: a second run changes nothing.
-- apply_migration adds its own row for this part (kafaa_cleanup_history_repair).
insert into supabase_migrations.schema_migrations (version, name, statements) values
('20261012230001', 'kafaa_audit_rpc_only_tables_p1', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/01_kafaa_audit_rpc_only_tables_p1.sql sha256 5bf7ad24f156909ff4b029d0bda7a20bc4d0413ba15ebaec911d2e4757baa385']),
('20261012230002', 'kafaa_audit_grants_p1', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/02_kafaa_audit_grants_p1.sql sha256 32df68858fc9c7cda2f1f87dafa852fac794a998a95f36972504a4efe56fbff0']),
('20261012230003', 'kafaa_audit_integrity_p1', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/03_kafaa_audit_integrity_p1.sql sha256 38b21e5631af1c59a94034576daaec1142bf438b9cb7fc06ad3460acb50bf580']),
('20261012230004', 'kafaa_audit_contact_requests_p1', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/04_kafaa_audit_contact_requests_p1.sql sha256 88ac5e9ff82985269fc95a57634e2a7de89ae4fa960be62cd017c6eab0f69412']),
('20261012230005', 'kafaa_audit_verify_certificate_p1', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/05_kafaa_audit_verify_certificate_p1.sql sha256 fce0b76a016ca2c699546e7b4ddc22c7bfdb241f20c6d17f44795847d84196b1']),
('20261012230006', 'kafaa_audit_backfill_p01', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/backfill/01_kafaa_audit_backfill_p01.sql sha256 7ee54692728d624c5693073419905a9aa2d9ec82443df1f0f78a1b3be9e2a746']),
('20261012230007', 'kafaa_audit_backfill_p02', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/backfill/02_kafaa_audit_backfill_p02.sql sha256 cd9524f5e6ef932b127d6511dcd4c0b600efafb60fb1ec50b0c350afc1007a14']),
('20261012230008', 'kafaa_audit_backfill_p03', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/backfill/03_kafaa_audit_backfill_p03.sql sha256 394a2bb2d280ce54233371d35946fcdb07fc447604f84d519a07733f0f3ea432']),
('20261012230009', 'kafaa_audit_backfill_p04', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/backfill/04_kafaa_audit_backfill_p04.sql sha256 f21ba323daeaadb2d379db3f41be0e44ffb7124c58587a4fa0e0dd5e2e63e133']),
('20261012230010', 'kafaa_audit_backfill_p05', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/backfill/05_kafaa_audit_backfill_p05.sql sha256 a74fad2572115bf6bafa9835fa100d578fa93eedd2b40af2bd6608fc3fe70e7b']),
('20261012230011', 'kafaa_audit_backfill_p06', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/backfill/06_kafaa_audit_backfill_p06.sql sha256 9ec22402d6fad431a38097d6a97214a57d5c630f4c434ff7e50974c1c5c83871']),
('20261012230012', 'kafaa_audit_backfill_p07', array['-- applied by hand in the SQL editor 2026-10-12 ~23:00-23:14 UTC; source docs/kafaa/ref/live_apply/audit_fixes/backfill/07_kafaa_audit_backfill_p07.sql sha256 e2649cc0b940c815908c8bc2167b69850661dacc7d576239f73a941eec8486de'])
on conflict (version) do nothing;

-- kafaa_ready_ar_values_p1 (1/1) · readiness fixes 2026-10-13, finding 6 · DATA UPDATE: apply only with the owner's explicit approval
-- Apply with apply_migration name "kafaa_ready_ar_values_p1", any time after part kafaa_ready_ar_columns_p1 (it adds the columns).
-- Fills the Arabic columns with the values a fresh build seeds (scripts/seed/ext/zz-ready-integrity.mjs AR). Guarded: a row changes only while
-- its English value is the seeded text and its Arabic value is still empty, so a second run (or an edited row) changes nothing. Touches only
-- the *_ar columns named; the tables' audit triggers write one audit row per changed row. Expected: see EXPECTED.md section 6.
update kafaa_job_roles set regulation_ref_ar = 'لوائح الهيئة الاتحادية للرقابة النووية للوقاية من الإشعاع' where regulation_ref = 'FANR radiation protection regulations' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-08 الإصدار 2' where regulation_ref = 'FANR-REG-08 V2' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-08 الإصدار 2 (يضيف الأمن السيبراني)' where regulation_ref = 'FANR-REG-08 V2 (adds cyber security)' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-10 (محاسبة المواد النووية)' where regulation_ref = 'FANR-REG-10 (nuclear material accounting)' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-10؛ اتفاق الضمانات مع الوكالة الدولية للطاقة الذرية' where regulation_ref = 'FANR-REG-10; IAEA safeguards agreement' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-12 المادة 23' where regulation_ref = 'FANR-REG-12 Art. 23' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-16 المادة 22' where regulation_ref = 'FANR-REG-16 Art. 22' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-16 المادة 9 (التدريب في الكيمياء)' where regulation_ref = 'FANR-REG-16 Art. 9 (chemistry training)' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-17 (يحمل شهادة كبير مشغّلي المفاعل)' where regulation_ref = 'FANR-REG-17 (holds SRO certificate)' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-17 (إعادة تأهيل المدرّب المؤهل ككبير مشغّلي المفاعل)' where regulation_ref = 'FANR-REG-17 (SRO-qualified instructor requalification)' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-17 المادة 12 (تأهيل المرخَّص له)' where regulation_ref = 'FANR-REG-17 Art. 12 (licensee qualification)' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-17 المواد 4 و7 و8 و10 و11' where regulation_ref = 'FANR-REG-17 Art. 4, 7, 8, 10, 11' and regulation_ref_ar is null;
update kafaa_job_roles set regulation_ref_ar = 'FANR-REG-17 المواد 4 و8 و10 و11' where regulation_ref = 'FANR-REG-17 Art. 4, 8, 10, 11' and regulation_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'بيان ENEC عن برنامج GPO (أغسطس 2025)' where rule_ref = 'ENEC GPO release (Aug 2025)' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'مسار المواهب في ENEC' where rule_ref = 'ENEC talent pipeline' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'FANR-REG-12 المادة 23' where rule_ref = 'FANR-REG-12 Art. 23' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'FANR-REG-17 المادة 1 (مدرّب مؤهل ككبير مشغّلي المفاعل)' where rule_ref = 'FANR-REG-17 Art. 1 (SRO Qualified Instructor)' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'FANR-REG-17 المادة 4' where rule_ref = 'FANR-REG-17 Art. 4' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'FANR-REG-17 المادة 4 (المشغّل الميداني: شهادة الثانوية العامة)' where rule_ref = 'FANR-REG-17 Art. 4 (LO: high-school diploma)' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'FANR-REG-17 المواد 4 و7 و10' where rule_ref = 'FANR-REG-17 Art. 4, 7, 10' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'دليل الوكالة الدولية للطاقة الذرية SSG-75، البند 3.17' where rule_ref = 'IAEA SSG-75 §3.17' and rule_ref_ar is null;
update kafaa_career_paths set rule_ref_ar = 'دليل الوكالة الدولية للطاقة الذرية SSG-75، البنود 3.28-3.34' where rule_ref = 'IAEA SSG-75 §3.28-3.34' and rule_ref_ar is null;
update kafaa_programmes set population_note_ar = 'مشغّلًا معتمدًا، 2024' where population_note = 'certified operators, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'أكملوا البرنامج منذ بداية 2024' where population_note = 'completed YTD 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'إتمامًا، 2024' where population_note = 'completions, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'مهندسًا في التدريب الأولي والمستمر، 2024' where population_note = 'engineers in initial + continuing, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'قائدًا، 2024' where population_note = 'leaders, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'مشغّلًا ميدانيًا، 2024' where population_note = 'local operators, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'مشغّلًا، 2024' where population_note = 'operators, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'شخصًا في برنامج التدريب الهندسي العام (GET)، 2024' where population_note = 'people in GET, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'شخصًا، 2024' where population_note = 'people, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'من كبار القادة، 2024' where population_note = 'senior leaders, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'موظفًا في التدريب الأولي والمستمر، 2024' where population_note = 'staff in initial + continuing, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'متدربًا في التدريب الأولي والمستمر، 2024' where population_note = 'trainees in initial + continuing, 2024' and population_note_ar is null;
update kafaa_programmes set population_note_ar = 'متدربًا، 2024' where population_note = 'trainees, 2024' and population_note_ar is null;
update kafaa_programmes set conflict_note_ar = 'COCT: ‏6 أسابيع (SR2024) مقابل نحو 5 أسابيع (CNS).' where conflict_note = 'COCT: 6 weeks (SR2024) vs about 5 weeks (CNS).' and conflict_note_ar is null;
update kafaa_programmes set conflict_note_ar = 'COCT/LOCT: ‏6 أسابيع (SR2024) مقابل نحو 5 أسابيع (CNS).' where conflict_note = 'COCT/LOCT: 6 weeks (SR2024) vs about 5 weeks (CNS).' and conflict_note_ar is null;
update kafaa_programmes set conflict_note_ar = 'مدة COIT: ‏91 أسبوعًا (SR2024) مقابل 82 أسبوعًا (تقرير CNS).' where conflict_note = 'COIT length: 91 weeks (SR2024) vs 82 weeks (CNS report).' and conflict_note_ar is null;
update kafaa_programmes set conflict_note_ar = 'عدد أجهزة المحاكاة الكاملة: 2 في مركز التدريب على المحاكاة أو 4 إجمالًا (تختلف المصادر).' where conflict_note = 'Number of full-scope simulators: 2 at the STC or 4 in total (sources differ).' and conflict_note_ar is null;
update kafaa_talent_programmes set conflict_note_ar = 'بداية برنامج DNT: ‏2023 (بيان الإطلاق) أو 2024 (بيان التخرج)؛ الدفعة الأولى 20 (SR2024) أو 30 تم توظيفهم (CNS).' where conflict_note = 'DNT start: 2023 (launch release) or 2024 (graduation release); first cohort 20 (SR2024) or 30 recruited (CNS).' and conflict_note_ar is null;
update kafaa_talent_programmes set conflict_note_ar = 'مدة برنامج GDP: ‏18-36 شهرًا (صفحة الوظائف) مقابل 12-30 شهرًا (بيان GPO، أغسطس 2025).' where conflict_note = 'GDP length: 18-36 months (careers page) vs 12-30 months (Aug 2025 GPO release).' and conflict_note_ar is null;
update kafaa_talent_programmes set conflict_note_ar = 'تاريخ التوقيع: 6 مايو (ENEC) مقابل 14 مايو (المكتب الإعلامي لأبوظبي) مقابل 27 مايو 2026 (WNN).' where conflict_note = 'Signing date: 6 May (ENEC) vs 14 May (Abu Dhabi Media Office) vs 27 May 2026 (WNN).' and conflict_note_ar is null;
update kafaa_facts set conflict_note_ar = 'الوكالة الدولية للطاقة الذرية: بلغت حصة الطاقة النووية 21.8% من توليد الكهرباء في 2024.' where conflict_note = 'IAEA: 21.8% nuclear share of 2024 generation.' and conflict_note_ar is null;
update kafaa_facts set conflict_note_ar = 'تذكر البيانات الصحفية "أكثر من 3,000 موظف، 60% منهم إماراتيون"؛ وتذكر بيانات GRI المدققة لعام 2024 الرقمين 2,979 و54.7%.' where conflict_note = 'Press releases say "over 3,000 people, 60% Emirati"; the audited 2024 GRI data say 2,979 and 54.7%.' and conflict_note_ar is null;
update kafaa_vacancies set location_ar = 'أبوظبي' where location = 'Abu Dhabi' and location_ar is null;
update kafaa_vacancies set location_ar = 'براكة، منطقة الظفرة' where location = 'Barakah, Al Dhafra' and location_ar is null;

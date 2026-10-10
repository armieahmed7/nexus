# Kafa'a platform access matrix

Generated from `src/auth/policy.ts` by `scripts/gen-policy.mjs`. The same table is loaded into `kafaa_policy_matrix` (Supabase) and enforced by the LocalBackend.

Codes: · none · R read · Own own records · Scope records in the user's assigned scope · Agg aggregate only (groups under 10 suppressed) · W create/edit · A approve/decide · OwnOrg own organisation's records · OrgW write own organisation's records. [K] = Kafa'a addition to the spec matrix.

| Resource | Public | Applicant / student | Employee / trainee | Licensed operator | Line manager / shift supervisor | Instructor / evaluator | Training manager | Licensing coordinator | HR / Emiratization analyst | HR authority (CHCO office) | Partner user | Partner admin | University partner | Observer (read-only) | Content editor | ECP officer | Platform admin | Auditor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Public pages, directory, Dalil public (`public_content`) | R | R | R | R | R | R | R | R | R | R | R | R | R | R | R W | R | R A | R |
| Own profile, settings, data rights (`own_profile`) | · | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own |
| Programme applications (`applications`) | · | Own | Own | · | · | · | · | · | Agg | Agg A | · | · | · | · | · | · | · | R |
| Qualification record (`qual_records`) | · | · | Own | Own | Own Scope | Own Scope | Own Scope | Own Scope | Own Agg | · | · | · | · | · | · | · | · | R |
| Sign off task evaluation or JPM (`signoff`) | · | · | · | · | · | A | A | · | · | · | · | · | · | · | · | · | · | · |
| Qualification standards and frameworks (`frameworks`) | R | R | R | R | R | R W | R W | R | R | R | · | · | R | · | R | R | R A | R |
| Licence tracker (RO/SRO) (`licence`) | · | · | · | Own | Scope | · | · | R W | Agg | · | · | · | · | · | · | · | · | R |
| Medical due flag (`medical_flag`) | · | · | · | Own | · | · | · | Scope | · | · | · | · | · | · | · | · | · | · |
| Training catalogue (internal) and enrolment (`training`) | · | · | Own | Own | Own A | Own W | Own W A | Own R | Own R | · | Own | Own OwnOrg | · | · | · | · | · | R |
| Secure exam items (`secure_items`) | · | · | · | · | · | W | W A | · | · | · | · | · | · | · | · | · | · | · |
| Workforce and Emiratization analytics (`workforce_analytics`) | · | · | · | · | Agg | · | · | · | Agg | Agg | · | · | · | Agg | · | · | · | R |
| Release report to an observer (`observer_release`) | · | · | · | · | · | · | · | · | W | W A | · | · | · | · | · | · | A | R |
| Partner organisation records (`partner_org`) | · | · | · | · | · | · | · | · | · | · | OwnOrg | OwnOrg OrgW | OwnOrg | · | · | · | R A | R |
| Contractor equivalency (`equivalency`) | · | · | · | · | · | A | A | · | · | · | · | OwnOrg OrgW | · | · | · | · | · | R |
| Scholar and intern cohorts (`cohorts`) | · | Own | · | · | · | · | · | · | Scope | Scope | · | · | Scope | · | · | · | · | R |
| Dalil configuration, corpus, logs (`dalil_config`) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | W | · | A | R |
| Users, roles and scopes (`users_roles`) | · | · | · | · | · | · | · | · | · | · | · | OwnOrg OrgW | · | · | · | · | R W | R |
| Audit log (`audit_log`) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | R | R |
| [K] ECP referral log (no concern text) (`concern_cases`) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | R A | · | · |
| [K] Internal learning content and OE lessons (`internal_content`) | · | · | R | R | R | R W | R W | R | R | R | · | · | · | · | R W | R | R | R |
| [K] Individual development plans (`dev_plans`) | · | · | Own | Own | Own Scope A | · | Own Scope | · | · | · | · | · | · | · | · | · | · | R |
| [K] Research proposals and screening (`research`) | · | · | · | · | · | · | · | · | · | · | OwnOrg OrgW | OwnOrg OrgW | OwnOrg OrgW | · | · | · | R A | R |
| [K] Vacancies, programme pages and events (`talent_content`) | R | R | R | R | R | R | R | R | R W | R W | R | R | R | R | R W | R | R A | R |
| [K] Notifications (`notifications`) | · | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own | Own |
| [K] Integrations and sync status (`integrations`) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | R A | R |
| [K] Person skill state, skill evidence and claims (F01) (`skills_profile`) | · | · | Own | Own | Own Scope | Own Scope | Own Scope A | Own | Own Agg | Own Agg | · | · | · | · | Own | Own | Own | · |
| [K] Opportunity marketplace, rotations and alumni reserve (`opportunities`) | · | · | R Own | R Own | R Own W A | R Own | R Own W A | R Own | R Own Agg | R Own Agg A | · | · | · | · | R Own | R Own | R Own | R |
| [K] Talent review and succession (confidential) (`talent_review`) | · | · | · | · | Scope | · | · | · | Scope Agg | R A | · | · | · | · | · | · | · | · |
| [K] Knowledge continuity: KLRA and captured knowledge (`knowledge`) | · | · | R | R | R Scope | R W | R W A | R | R Agg | R Agg | · | · | · | · | R | R | R | R |
| [K] Training effectiveness and needs analytics (`learning_analytics`) | · | · | Own | Own | Own Agg W | Own Agg | Own Agg W A | · | Agg | Agg | · | · | · | · | · | · | · | R |
| [K] SAT analysis and accreditation workbench (`sat`) | · | · | · | · | · | R W | R W A | · | · | · | · | · | · | · | · | · | · | R |
| [K] Learning record store (xAPI statements) (`lrs`) | · | · | Own | Own | Own Scope | Own Scope | Own Scope Agg | · | Agg | · | · | · | · | · | · | · | · | R |
| [K] Skills taxonomy governance: change proposals, council decisions, public change log (FS54) (`skills_taxonomy`) | R | R | R W | R W | R W | R W | R W A | R W | R W | R W A | R | R | R | R | R W | R W | R W A | R |
| [K] AI and digital fluency: ladder, fitness checks, AI-literacy register, sandbox (FS09/FS10/FS36/FS37/FS80) (`ai_literacy`) | · | · | R Own | R Own | R Own | R Own | R Own W | R Own | R Own Agg | R Own Agg | · | · | · | · | R Own | R Own | R Own W A | R |
| [K] Role transformation: 2030/2035 role profiles, task exposure, transition plans (FS05/FS06/FS11/FS12/FS81) (`transformation`) | · | · | R Own | R Own | R Own Scope | R Own | R Own W | R Own | R Own Agg | R Own Agg W A | · | · | · | · | R Own | R Own | R Own | R |
| [K] Recognition of prior learning, NQF levels, credits and learning balance (FS24/FS29/FS30/FS78/FS79) (`recognition`) | · | · | Own | Own | Own Scope | Own A | Own A | Own | Own Agg | Own Agg A | · | · | · | · | Own | Own | Own | R |
| [K] Workforce strategy and disclosure: critical skills, forecasts, ISO 30414 pack, pilots (FS50/FS51/FS60/FS61) (`workforce_strategy`) | · | · | · | · | · | · | Agg | · | Agg W | Agg W A | · | · | · | · | · | · | R | R |
| [K] Skills ecosystem: regional plan, pledges, fellowships, grants, consortium cohorts (FS64-FS69, FS82/FS83) (`ecosystem`) | · | · | R Own | R Own | R Own | R Own | R Own | R Own | R Own Agg W | R Own Agg W A | R OwnOrg | R OwnOrg OrgW | R OwnOrg OrgW | · | R Own | R Own | R Own A | R |
| [K] National-strategy alignment and MoHRE mapping (FS62/FS63) (`national_alignment`) | · | · | R | R | R | R | R | R | R Agg | R W | · | · | · | · | R | R | R W A | R |

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

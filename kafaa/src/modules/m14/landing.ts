// Where a persona lands after sign-in, by most specific role (moved out of SignInPage so /my can point non-employees to their area).
import type { PlatformRole } from '../../auth/policy';

export function landing(roles: readonly PlatformRole[]): string {
  if (roles.includes('observer')) return '/observer';
  if (roles.includes('partner_admin') || roles.includes('partner_user') || roles.includes('university')) return '/partner';
  if (roles.includes('admin') || roles.includes('editor')) return '/admin';
  if (roles.includes('auditor') && !roles.includes('employee')) return '/admin/audit';
  if (roles.includes('applicant') && roles.length === 1) return '/my/applications';
  return '/my';
}

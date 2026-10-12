// M37 SupabaseBackend RPC mappings (owners: wave G E2 (FS62, FS63) and wave H E2 (FS73, FS74)). Installed by src/data/ext/supabase.ts.
// x.call('kafaa_<name>', { p_... }, ['<tables touched>']) for Result-returning RPCs; x.rpc(fn, args) for plain reads.
// FS62/FS63 SQL: supabase/migrations/20261010272001_kafaa_fs72_national_alignment.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { NationalReport } from '../national';
import type { OccupationTrend } from '../occupations';
import type { M37Rpc } from './rpc';

export function makeSupabaseM37(x: SupabaseExtCtx): M37Rpc {
  return {
    nationalReport: async (filter) => (await x.rpc<NationalReport | null>('kafaa_national_report', { p_filter: filter ?? {} })) ?? null,
    saveNationalTag: (input) => x.call('kafaa_save_national_tag', { p: input ?? {} }, ['national_tags']),
    setTagLink: (input) => x.call('kafaa_set_tag_link', { p: input ?? {} }, ['tag_links']),
    saveRoleOccupation: (input) => x.call('kafaa_save_role_occupation', { p: input ?? {} }, ['role_occupations']),
    verifyOccupationCode: (input) => x.call('kafaa_verify_occupation_code', { p: input ?? {} }, ['role_occupations']),
    clearOccupationCode: (roleId, reason) => x.call('kafaa_clear_occupation_code', { p_role_id: roleId, p_reason: reason }, ['role_occupations']),
    occupationTrend: async () => (await x.rpc<OccupationTrend | null>('kafaa_occupation_trend')) ?? null,
  };
}

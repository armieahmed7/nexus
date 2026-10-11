// M24 SupabaseBackend RPC mappings (owner: W3 · E2 · F20 KLRA, F21 Knowledge capture studio). Installed by src/data/ext/supabase.ts.
// SQL: supabase/migrations/20261009132001_kafaa_w3e2_knowledge.sql. Pages never import this file.
import type { SupabaseExtCtx } from '../../../data/ext/types';
import type { CaptureBoard, Heatmap, KlraPositionDetail, KlraRegister, M24Rpc, ReviewQueue } from './rpc';

export function makeSupabaseM24(x: SupabaseExtCtx): M24Rpc {
  return {
    klraRegister: async (period = null) => x.rpc<KlraRegister>('kafaa_klra_register', { p_period: period ?? null }),
    klraHeatmap: async (period = null) => (await x.rpc<Heatmap | null>('kafaa_klra_heatmap', { p_period: period ?? null })) ?? null,
    klraPosition: async (positionId) => (await x.rpc<KlraPositionDetail | null>('kafaa_klra_position', { p_id: positionId })) ?? null,
    assessPosition: (input) => x.call('kafaa_assess_position', { p: input ?? {} }, ['klra_assessments']),
    reassessQuarter: (period = null) => x.call('kafaa_reassess_quarter', { p_period: period ?? null }, ['klra_assessments']),
    planMitigation: (input) => x.call('kafaa_plan_mitigation', { p: input ?? {} }, ['klra_actions']),
    closeAction: (id, outcome, note = '') => x.call('kafaa_close_action', { p_id: id, p_outcome: outcome, p_note: note ?? '' }, ['klra_actions']),
    setKlraThresholds: (high, medium) => x.call('kafaa_set_klra_thresholds', { p_high: high, p_medium: medium }, ['klra_settings', 'klra_assessments']),
    setSmeProfile: (input) => x.call('kafaa_set_sme_profile', { p: input ?? {} }, ['sme_profiles']),
    planCapture: (input) => x.call('kafaa_plan_capture', { p: input ?? {} }, ['capture_sessions', 'klra_actions', 'sme_profiles', 'notifications']),
    recordCapture: (id, input) => x.call('kafaa_record_capture', { p_id: id, p: input ?? {} }, ['capture_sessions']),
    captureBoard: async () => (await x.rpc<CaptureBoard | null>('kafaa_capture_board')) ?? { mode: 'mine', can_plan: false, sessions: [] },
    submitAsset: (input) => x.call('kafaa_submit_asset', { p: input ?? {} }, ['knowledge_assets', 'asset_reviews', 'capture_sessions']),
    reviewQueue: async () => (await x.rpc<ReviewQueue | null>('kafaa_review_queue')) ?? { can_review: false, can_publish: false, items: [] },
    reviewAsset: (input) => x.call('kafaa_review_asset', { p: input ?? {} }, ['asset_reviews', 'knowledge_assets', 'notifications']),
    publishAsset: (id) => x.call('kafaa_publish_asset', { p_id: id }, ['knowledge_assets', 'klra_actions', 'notifications']),
    withdrawAsset: (id, reason) => x.call('kafaa_withdraw_asset', { p_id: id, p_reason: reason ?? '' }, ['knowledge_assets']),
    attachAssetRequal: (id, standardIds) => x.call('kafaa_attach_asset_requal', { p_id: id, p_standard_ids: standardIds ?? [] }, ['knowledge_assets']),
    markAssetUsed: (id) => x.call('kafaa_mark_asset_used', { p_id: id }, ['asset_uses', 'knowledge_assets']),
  };
}

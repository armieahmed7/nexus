/** F01 (wave 0): M17-M27 scaffolding is registered once so wave engineers only touch their own module folder. */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { MODULES } from '../../src/routes/modules';
import { ROUTES } from '../../src/routes/registry';
import { RESOURCES, MATRIX } from '../../src/auth/policy';
import { SCHEMA } from '../../src/data/schema';
import { LocalBackend } from '../../src/data/local/LocalBackend';

const NEW = Array.from({ length: 11 }, (_, i) => `M${17 + i}`);
describe('M17-M27 scaffolding', () => {
  it('registers every new module with a name, group, routes file, backend files and EN/AR namespaces', () => {
    for (const id of NEW) {
      const m = id.toLowerCase();
      expect(MODULES[id as keyof typeof MODULES], id).toBeTruthy();
      for (const f of ['routes.ts', 'backend/schema.ts', 'backend/rpc.ts', 'backend/local.ts', 'backend/supabase.ts']) expect(existsSync(`src/modules/${m}/${f}`), `${m}/${f}`).toBe(true);
      for (const l of ['en', 'ar']) expect(JSON.parse(readFileSync(`src/i18n/${m}.${l}.json`, 'utf8')).module.name).toBeTruthy();
      expect(readFileSync('src/routes/registry.ts', 'utf8')).toContain(`../modules/${m}/routes`);
    }
  });
  it('every route has EN and AR title and purpose keys', () => {
    for (const r of ROUTES) {
      const ns = r.module.toLowerCase();
      for (const l of ['en', 'ar']) {
        const d = JSON.parse(readFileSync(`src/i18n/${ns}.${l}.json`, 'utf8'));
        expect(d.routes?.[r.id]?.title, `${ns}.${l} ${r.id}`).toBeTruthy();
        expect(d.routes?.[r.id]?.purpose, `${ns}.${l} ${r.id}`).toBeTruthy();
      }
    }
  });
  it('adds the seven new policy resources with matrix rows', () => {
    for (const r of ['skills_profile', 'opportunities', 'talent_review', 'knowledge', 'learning_analytics', 'sat', 'lrs']) {
      expect(RESOURCES).toContain(r);
      expect(Object.keys(MATRIX[r as keyof typeof MATRIX]).length).toBeGreaterThan(0);
    }
    expect(MATRIX.skills_profile.partner_user).toBeUndefined();
    expect(MATRIX.talent_review.employee).toBeUndefined();
  });
  it('the schema carries the F01/F02 tables and the module blocks merge in', () => {
    for (const t of ['skills', 'skill_evidence', 'person_skills', 'engine_settings']) expect(SCHEMA[t], t).toBeTruthy();
    expect(SCHEMA.person_skills.write.mode).toBe('rpc');
  });
  it('module RPC hooks are installed on both backends', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    expect(typeof b.rpc.recomputeSkills).toBe('function');
    expect(typeof b.rpc.setEngineWeights).toBe('function');
    expect(readFileSync('src/data/supabase/SupabaseBackend.ts', 'utf8')).toContain('makeExtSupabaseRpc');
  });
});

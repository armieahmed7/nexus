/** [G4] M11 advanced reactors and future workforce: acceptance (MoU source and date, no headcount or sites on public payloads),
 *  SIMULATED skills-gap rules and the HR gap-plan RPC on the LocalBackend. */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { adjustDemand, HEADCOUNT_OR_SITE, publicTextIsClean, skillGap, validGapPlan } from '../../src/domain/future';

let b: LocalBackend;
async function as(persona: string | null) {
  b.setPersona(persona);
  await b.whenReady();
}
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('M11 rules', () => {
  it('gap = demand minus readiness, banded; demand scales between 0.5x and 1.5x and stays within 0-100', () => {
    expect(skillGap(60, 25)).toEqual({ gap: 35, band: 'high' });
    expect(skillGap(40, 22)).toEqual({ gap: 18, band: 'medium' });
    expect(skillGap(30, 25).band).toBe('low');
    expect(skillGap(20, 50)).toEqual({ gap: 0, band: 'none' });
    expect(adjustDemand(80, 1.5)).toBe(100);
    expect(adjustDemand(80, 3)).toBe(100);
    expect(adjustDemand(80, 0.1)).toBe(40);
  });
  it('a gap plan needs a known action, an owner role and a quarter within five years', () => {
    const now = new Date('2026-10-08T00:00:00Z');
    expect(validGapPlan({ skill_key: 'x', action: 'train', owner_role: 'Nuclear Training', target_quarter: '2027-Q2' }, now)).toEqual([]);
    expect(validGapPlan({ skill_key: '', action: 'fire', owner_role: 'a', target_quarter: '2040-Q1' }, now)).toEqual(['skill', 'action', 'owner', 'quarter']);
    expect(validGapPlan({ skill_key: 'x', action: 'hire', owner_role: 'HR (role)', target_quarter: '2027-Q5' }, now)).toEqual(['quarter']);
  });
  it('the headcount/site guard catches projections but not ordinary skill text', () => {
    expect(HEADCOUNT_OR_SITE.test('about 400 staff a year')).toBe(true);
    expect(HEADCOUNT_OR_SITE.test('candidate site in Al Dhafra')).toBe(true);
    expect(HEADCOUNT_OR_SITE.test('projected headcount')).toBe(true);
    expect(HEADCOUNT_OR_SITE.test('Liquid-metal handling and chemistry, fast-spectrum physics')).toBe(false);
  });
});

describe('M11 acceptance', () => {
  it('each technology entry cites its MoU source and date', async () => {
    await as(null);
    const techs = await b.list('adv_technologies');
    expect(techs.length).toBe(6);
    for (const x of techs) {
      expect(x.mou_date).toMatch(/20\d\d/);
      const s = x.sources as { url: string; label: string }[];
      expect(s.length).toBeGreaterThan(0);
      expect(s.every((y) => /^https:\/\//.test(y.url) && y.label)).toBe(true);
    }
  });
  it('the public M11 payloads contain no projected headcount or site information', async () => {
    await as(null);
    const rows = [
      ...(await b.list('adv_technologies')), ...(await b.list('adv_skills')), ...(await b.list('future_roles')),
      ...(await b.list('adv_tracks')), ...(await b.list('skill_bridges')),
    ];
    expect(rows.length).toBeGreaterThan(50);
    expect(publicTextIsClean(rows)).toBe(true);
    for (const r of rows) for (const k of Object.keys(r)) expect(k).not.toMatch(/headcount|fte|site|location|count/i);
    // the public page strings too
    for (const lang of ['en', 'ar']) {
      const pub = JSON.parse(readFileSync(`src/i18n/m11.${lang}.json`, 'utf8')).pub;
      expect(/\d+\s*(staff|people|jobs|positions|operators|engineers)/i.test(JSON.stringify(pub))).toBe(false);
    }
  });
  it('SIMULATED radar values and gap plans are HR-only: the public and partners see none', async () => {
    await as(null);
    expect(await b.list('future_skills')).toEqual([]);
    expect(await b.list('skill_gap_plans')).toEqual([]);
    await as('alnoor-gm');
    expect(await b.list('future_skills')).toEqual([]);
    await as('k-hr-analyst');
    const fs = await b.list('future_skills');
    expect(fs.length).toBe(16);
    expect(fs.every((f) => f.simulated && f.scenario.includes('SIMULATED') && f.readiness != null && f.skill_key)).toBe(true);
  });
  it('HR records a gap plan through the audited RPC; others are refused', async () => {
    await as('k-hr-analyst');
    const y = new Date().getUTCFullYear() + 1;
    const r = await b.rpc.saveSkillGapPlan({ skill_key: 'salt-chemistry', scenario: 'Scenario A (SIMULATED)', action: 'partner', owner_role: 'Nuclear Training (role)', target_quarter: `${y}-Q3` });
    expect(r.ok).toBe(true);
    expect(b.raw('audit_events').at(-1)).toMatchObject({ action: 'future.gap_plan', outcome: 'ok' });
    const upd = await b.rpc.saveSkillGapPlan({ id: r.data!.id, skill_key: 'salt-chemistry', scenario: 'Scenario A (SIMULATED)', action: 'train', owner_role: 'Nuclear Training (role)', target_quarter: `${y}-Q4`, status: 'active' });
    expect(upd.data?.id).toBe(r.data!.id);
    expect((await b.get('skill_gap_plans', r.data!.id))?.status).toBe('active');
    expect((await b.rpc.saveSkillGapPlan({ skill_key: 'nope', scenario: 'A', action: 'train', owner_role: 'Nuclear Training', target_quarter: `${y}-Q1` })).code).toBe('not_found');
    expect((await b.rpc.saveSkillGapPlan({ skill_key: 'salt-chemistry', scenario: 'A', action: 'train', owner_role: 'Nuclear Training', target_quarter: '1999-Q1' })).code).toBe('invalid');
    await as('k-auditor');
    expect((await b.rpc.saveSkillGapPlan({ skill_key: 'salt-chemistry', scenario: 'A', action: 'train', owner_role: 'Nuclear Training', target_quarter: `${y}-Q1` })).code).toBe('forbidden');
  });
});

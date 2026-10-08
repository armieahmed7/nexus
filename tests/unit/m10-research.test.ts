/** [G3] M10 universities and research: consent rule, cohort scope, proposal and challenge screening on the LocalBackend. */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';

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

describe('university partner', () => {
  it('sees no student who has not consented to share with that university', async () => {
    await as('k-university');
    const s = await b.list('scholars');
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.consent_university && x.university_org_id === 'ku')).toBe(true);
    expect(s.find((x) => x.id === 'sc-3')).toBeUndefined();
  });
  it('reads cohort aggregates for its own university only', async () => {
    await as('k-university');
    const c = await b.list('scholar_cohorts');
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((x) => x.university_org_id === 'ku')).toBe(true);
    await as('alnoor-gm');
    expect(await b.list('scholar_cohorts')).toEqual([]);
  });
});

describe('research challenges and proposals', () => {
  it('a challenge cannot publish without a screening sign-off recorded in the audit log', async () => {
    await as('k-admin');
    const r = await b.rpc.screenResearchChallenge('rc-4', true, false);
    expect(r.ok).toBe(true);
    await as(null);
    expect(await b.get('research_challenges', 'rc-4')).toBeNull();
    await as('k-admin');
    await b.rpc.screenResearchChallenge('rc-4', true, true);
    const audit = (await b.list('audit_events')).filter((e) => e.action === 'research.screen' && e.entity_id === 'rc-4');
    expect(audit.length).toBe(2);
    await as(null);
    expect((await b.get('research_challenges', 'rc-4'))?.is_published).toBe(true);
  });
  it('editing a published challenge unpublishes it until it is screened again', async () => {
    await as('k-admin');
    const e = await b.rpc.saveResearchChallenge({ id: 'rc-1', title_en: 'Arabic-first technical learning content (revised)', title_ar: 'محتوى تعليمي (منقح)', theme: 'Learning', summary_en: 'Revised.', summary_ar: 'منقح.', closes_on: '2027-03-31' });
    expect(e.data?.status).toBe('screening');
    await as(null);
    expect(await b.get('research_challenges', 'rc-1')).toBeNull();
  });
  it('a partner submits a proposal; it cannot be accepted before screening; partners cannot decide', async () => {
    await as('alnoor-gm');
    const p = await b.rpc.saveResearchProposal({ challenge_id: 'rc-1', title: 'Glossary audio', summary: 'Audio pronunciations for the Arabic nuclear glossary.', ip_route: null, submit: true });
    expect(p.ok).toBe(true);
    expect((await b.rpc.decideResearchProposal(p.data!.id, 'accepted', true, 'self accept')).code).toBe('forbidden');
    const direct = await b.update('research_proposals', p.data!.id, { status: 'accepted' });
    expect(direct.ok).toBe(false);
    expect((await b.rpc.saveResearchProposal({ id: p.data!.id, challenge_id: null, title: 'Edited after submit', summary: 'Edited after submission should be refused.', ip_route: null, submit: false })).code).toBe('invalid');
    await as('k-admin');
    expect((await b.rpc.decideResearchProposal(p.data!.id, 'accepted', false, 'Looks good')).code).toBe('invalid');
    expect((await b.rpc.decideResearchProposal(p.data!.id, 'accepted', true, 'Screened: no plant data')).ok).toBe(true);
  });
  it('a partner cannot answer an unpublished challenge or see another organisation proposals', async () => {
    await as('alnoor-gm');
    expect((await b.rpc.saveResearchProposal({ challenge_id: 'rc-4', title: 'Scenario tools', summary: 'Tools for simulator scenario authoring.', ip_route: null, submit: false })).code).toBe('invalid');
    const mine = await b.list('research_proposals');
    expect(mine.every((r) => r.org_id === 'org-alnoor')).toBe(true);
  });
});

/** G1 (M02/M03) RPCs on the LocalBackend: the same guarantees scripts/validate-migrations.g1.mjs checks in Postgres. */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { addWorkingDays, licenceView, medicalView, proficiency, qualView, routeChecks } from '../../src/domain/rules';

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
const audits = () => b.raw('audit_events').length;

describe('M02 qualification', () => {
  it('self-sign is refused with a clear error and an audit event', async () => {
    await as('k-instructor');
    const n0 = audits();
    const r = await b.rpc.signoffEvaluation({ record_id: 'qr-p-k-instructor-qs-instr', task_id: 'qs-instr-t1', result: 'pass' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('self_sign');
    expect(r.message).toMatch(/cannot sign off their own/);
    expect(audits()).toBe(n0 + 1);
    expect(b.raw('audit_events').at(-1)?.outcome).toBe('refused');
  });

  it('sign-off flow: evaluator signs, supervisor acknowledges once, evaluator cannot acknowledge', async () => {
    await as('k-instructor');
    const so = await b.rpc.signoffEvaluation({ record_id: 'qr-p-k-lo-trainee-qs-lo-turbine', task_id: 'qs-lo-turbine-t3', result: 'pass' });
    expect(so.ok).toBe(true);
    const evId = so.data!.evaluation_id;
    expect((await b.rpc.ackEvaluation(evId, 'x')).code).toBe('forbidden');
    await as('training-mgr');
    const ack = await b.rpc.ackEvaluation(evId, 'Observed on shift');
    expect(ack.ok).toBe(true);
    expect((await b.rpc.ackEvaluation(evId, 'again')).code).toBe('conflict');
    expect(b.raw('evaluation_acks').filter((a) => a.evaluation_id === evId)).toHaveLength(1);
    // append-only through the repository
    const upd = await b.update('evaluation_acks', ack.data!.ack_id, { note: 'edited' });
    expect(upd.ok).toBe(false);
  });

  it('a supervisor cannot acknowledge an evaluation they performed', async () => {
    await as('training-mgr');
    const so = await b.rpc.signoffEvaluation({ record_id: 'qr-w-instr-01-qs-instr', task_id: 'qs-instr-t1', result: 'pass' });
    expect(so.ok).toBe(true);
    const ack = await b.rpc.ackEvaluation(so.data!.evaluation_id, '');
    expect(ack.code).toBe('separation_of_duties');
  });

  it('30 days before expiry the person and their manager are notified once and the record shows due', async () => {
    await as('sro');
    const r = await b.rpc.qualExpirySweep();
    expect(r.ok).toBe(true);
    const nts = b.raw('notifications').filter((n) => n.id.startsWith('nt-qx-qr-w-lo-07-qs-lo-turbine-30-'));
    expect(nts.map((n) => n.person_id).sort()).toEqual(['p-sro', 'w-lo-07']);
    expect(b.rawGet('qual_records', 'qr-w-lo-07-qs-lo-turbine')?.status).toBe('due');
    const again = await b.rpc.qualExpirySweep();
    expect(again.data?.notices).toBe(0);
    // the matrix view of the record
    const rec = b.rawGet('qual_records', 'qr-w-lo-07-qs-lo-turbine')!;
    expect(qualView(rec).view).toBe('due');
  });

  it('only scoped roles can run the expiry sweep', async () => {
    await as('k-ro');
    expect((await b.rpc.qualExpirySweep()).code).toBe('forbidden');
  });

  it('revising a standard creates a new version, flags records, and review moves them to the new version', async () => {
    await as('k-instructor');
    const rv = await b.rpc.reviseStandard('qs-lo-aux', 'Procedure revision after an OE lesson');
    expect(rv.ok).toBe(true);
    expect(rv.data!.flagged).toBeGreaterThan(0);
    const flagged = b.raw('qual_records').filter((r) => r.needs_review);
    expect(flagged.length).toBe(rv.data!.flagged);
    expect((await b.rpc.reviewQualRecord(flagged[0].id, 'carry_over', '')).code).toBe('invalid');
    const ok = await b.rpc.reviewQualRecord(flagged[0].id, 'retrain', 'Changed step on the auxiliary feedwater lineup');
    expect(ok.ok).toBe(true);
    const rec = b.rawGet('qual_records', flagged[0].id)!;
    expect(rec.standard_id).toBe(rv.data!.new_id);
    expect(rec.status).toBe('in_progress');
    expect(rec.needs_review).toBe(false);
  });
});

describe('M03 licensing tracker', () => {
  it('SRO with 6 eight-hour shifts, 1 in the SRO role and 2 scheduled: SRO-role minimum at risk', () => {
    const p = proficiency({ shifts_8h: 6, shifts_12h: 0, sro_role_shifts: 1, scheduled_remaining_8h: 2, scheduled_remaining_12h: 0, scheduled_remaining_sro: 0 }, true);
    expect(p.atRisk).toBe(false);
    expect(p.sroAtRisk).toBe(true);
    expect(p.messages.map((m) => m.code)).toContain('sro_role_at_risk');
  });

  it('medical due date in the past with no new date: overdue view, and the sweep gives the coordinator a task', async () => {
    expect(medicalView({ due_on: '2026-09-15', flag: 'fit' }, new Date('2026-10-08T10:00:00Z'))).toBe('overdue');
    await as('k-licensing-coord');
    // remove the seeded task so the sweep must create it
    b.rawUpdate('licensing_tasks', 'lt-2', { status: 'done' });
    b.rawUpdate('medical_due', 'med-w-ro-01', { flag: 'fit' }); // a stale "fit" flag does not hide an overdue date
    const r = await b.rpc.detectLicensingEvents();
    expect(r.ok).toBe(true);
    expect(b.raw('licensing_tasks').some((t) => t.person_id === 'w-ro-01' && t.kind === 'medical_overdue' && t.status === 'open')).toBe(true);
  });

  it('a lapse detected on a Thursday has a deadline three UAE working days later', () => {
    expect(addWorkingDays('2026-10-08', 3)).toBe('2026-10-13');
  });

  it('a stale source sync never shows a certificate as valid', () => {
    const v = licenceView({ status: 'valid', expires_on: '2029-01-01', last_synced: '2026-10-02T04:00:00Z' }, new Date('2026-10-08T10:00:00Z'));
    expect(v.view).toBe('stale');
  });

  it('licensing alerts are coordinator-only and idempotent', async () => {
    await as('sro');
    expect((await b.rpc.licensingAlerts()).code).toBe('forbidden');
    await as('k-licensing-coord');
    const a = await b.rpc.licensingAlerts();
    expect(a.ok).toBe(true);
    expect(a.data!.proficiency).toBeGreaterThanOrEqual(1);
    const again = await b.rpc.licensingAlerts();
    const d = again.data!;
    expect(d.renewal + d.proficiency + d.exam_notice + d.withdrawal).toBe(0);
  });

  it('recording a new medical date closes the overdue task; a past date is refused', async () => {
    await as('k-licensing-coord');
    expect((await b.rpc.recordMedicalDate('w-ro-01', '2020-01-01', 'fit', 'OH-1')).code).toBe('invalid');
    const r = await b.rpc.recordMedicalDate('w-ro-01', '2027-09-01', 'fit', 'OH record 2026-118');
    expect(r.ok).toBe(true);
    expect(r.data!.closed).toBe(1);
    expect(b.rawGet('licensing_tasks', 'lt-2')?.status).toBe('done');
  });

  it('closing a task needs a note', async () => {
    await as('k-licensing-coord');
    expect((await b.rpc.closeLicensingTask('lt-1', 'no')).code).toBe('invalid');
    expect((await b.rpc.closeLicensingTask('lt-1', 'Lapse report sent by the named role')).ok).toBe(true);
    expect((await b.rpc.closeLicensingTask('lt-1', 'Lapse report sent by the named role')).code).toBe('invalid');
  });

  it('shift supervisors see crew availability only (no medical detail), and no medical rows', async () => {
    await as('sro');
    const av = await b.rpc.crewAvailability();
    const crews = av.map((r) => b.rawGet('people', r.person_id)?.crew);
    expect(av.length).toBeGreaterThan(0);
    expect(crews.every((c) => c === 'B')).toBe(true);
    expect(av.every((r) => Object.keys(r).sort().join() === 'available,person_id')).toBe(true);
    expect((await b.list('medical_due')).filter((m) => m.person_id !== 'p-sro')).toEqual([]);
  });

  it('eligibility explainer lists three RO and three SRO routes, each citing REG-17 Art. 4', () => {
    const r = routeChecks({ highSchool: true, bsc: false, monthsQualifiedLO: 40, monthsROatBarakah: 0, monthsRoSroElsewhere: 0, monthsFossilOrOther: 0, monthsAtBarakah: 40, monthsOnCrewAtBarakah: 40, monthsNuclearAtBarakah: 40, monthsAsLOatBarakah: 40 });
    expect(r.filter((x) => x.target === 'RO')).toHaveLength(3);
    expect(r.filter((x) => x.target === 'SRO')).toHaveLength(3);
    expect(r.every((x) => x.ruleRef === 'FANR-REG-17 Art. 4')).toBe(true);
    expect(r.find((x) => x.route === 'ro_lo36')!.met.every((m) => m.ok)).toBe(true);
  });
});

describe('M01 career map data', () => {
  it('all 28 roles are published with EN/AR titles, a basis and at least one source; RO and SRO list three entry routes', async () => {
    await as(null);
    const roles = await b.list('job_roles');
    expect(roles).toHaveLength(28);
    for (const r of roles) {
      expect(r.title_en && r.title_ar).toBeTruthy();
      expect(['barakah', 'generic', 'uncertain']).toContain(r.basis);
      expect((r.sources as unknown[]).length).toBeGreaterThan(0);
    }
    const routes = (id: string) => (roles.find((r) => r.id === id)!.entry_routes as { id: string; rule_ref: string }[]).filter((e) => e.id !== 'clearance');
    expect(routes('reactor-operator').map((e) => e.id)).toEqual(['ro_lo36', 'ro_other_plant', 'ro_fossil']);
    expect(routes('senior-reactor-operator')).toHaveLength(3);
    expect(routes('senior-reactor-operator').every((e) => /Art\. 4/.test(e.rule_ref))).toBe(true);
  });
});

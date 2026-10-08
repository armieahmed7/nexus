// Team approvals (M04): requested enrolments and external course requests from the approver's team.
// Used on /my/learning (managers) and /training (training manager). Scope and maker-checker are enforced by the RPCs.
import { useMemo, useState } from 'react';
import { Card, Async, ConfirmDialog, Skeleton } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { useCatalogue, usePeople } from './ui';

/** Managers and the training manager: requested enrolments and external requests from their team (scope enforced by the RPCs). */
export function TeamApprovals() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const cat = useCatalogue();
  const people = usePeople();
  const me = s.identity.personId;
  const q = useQuery(['enrolments', 'external_requests', 'sessions'], async () => {
    const [enr, ext, sessions] = await Promise.all([repo.list('enrolments', { filter: { status: 'requested' } }), repo.list('external_requests', { filter: { status: 'requested' } }), repo.list('sessions')]);
    return { enr, ext, sessions };
  }, []);
  const [act, setAct] = useState<{ kind: 'enrol' | 'ext'; id: string; decision: 'approve' | 'reject' } | null>(null);
  const visible = useMemo(() => new Set(people.list.map((p) => p.id)), [people.list]);
  return (
    <Async state={q}>
      {(d) => {
        const enr = d.enr.filter((e) => e.person_id !== me && visible.has(e.person_id));
        const ext = d.ext.filter((e) => e.person_id !== me && visible.has(e.person_id));
        const sess = new Map(d.sessions.map((x) => [x.id, x]));
        return (
          <div className="space-y-4" data-testid="m04-team-approvals">
            <Card title={t('m04.my.teamEnrolments', { n: f.num(enr.length) })}>
              {people.loading ? <Skeleton /> : enr.length === 0 ? <p className="text-ink-3">{t('m04.my.teamNone')}</p> : (
                <ul className="divide-y divide-line">
                  {enr.map((e) => { const c = cat.course.get(e.course_id); const x = e.session_id ? sess.get(e.session_id) : null; return (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div><div className="font-semibold">{people.name(e.person_id)}</div><div className="text-[12.5px] text-ink-3">{c ? `${c.code} · ${pick(c, 'title')}` : e.course_id}{x ? ` · ${f.dateTime(x.starts_at)}` : ''}</div></div>
                      <div className="flex gap-1"><button className="btn-primary btn-sm" onClick={() => setAct({ kind: 'enrol', id: e.id, decision: 'approve' })} data-testid="m04-approve">{t('m04.common.approve')}</button><button className="btn-outline btn-sm" onClick={() => setAct({ kind: 'enrol', id: e.id, decision: 'reject' })}>{t('m04.common.reject')}</button></div>
                    </li>
                  ); })}
                </ul>
              )}
            </Card>
            <Card title={t('m04.my.teamExternal', { n: f.num(ext.length) })}>
              {ext.length === 0 ? <p className="text-ink-3">{t('m04.my.teamNone')}</p> : (
                <ul className="divide-y divide-line">
                  {ext.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div><div className="font-semibold">{people.name(e.person_id)} · {e.title}</div><div className="text-[12.5px] text-ink-3">{e.provider}{e.cost_aed != null ? ` · ${f.num(e.cost_aed, { style: 'currency', currency: 'AED', maximumFractionDigits: 0 })}` : ''} · {e.justification}</div></div>
                      <div className="flex gap-1"><button className="btn-primary btn-sm" onClick={() => setAct({ kind: 'ext', id: e.id, decision: 'approve' })}>{t('m04.common.approve')}</button><button className="btn-outline btn-sm" onClick={() => setAct({ kind: 'ext', id: e.id, decision: 'reject' })}>{t('m04.common.reject')}</button></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <ConfirmDialog open={!!act} onClose={() => setAct(null)} title={act?.decision === 'approve' ? t('m04.my.approveTitle') : t('m04.my.rejectTitle')} danger={act?.decision === 'reject'}
              consequence={act?.decision === 'approve' ? t('m04.my.approveBody') : t('m04.my.rejectBody')} requireReason={act?.decision === 'reject'} actingAs={s.roles.includes('training_manager') ? t('m04.common.roleTm') : t('m04.common.roleManager')}
              onConfirm={async (reason) => {
                if (!act) return;
                if (act.kind === 'enrol') await run(() => repo.rpc.decideEnrolment(act.id, act.decision, reason));
                else await run(() => repo.rpc.decideExternalRequest(act.id, act.decision === 'approve' ? 'approved' : 'rejected', reason));
              }} />
          </div>
        );
      }}
    </Async>
  );
}

// M10 /admin/research: the research screening authority curates challenges (any edit unpublishes until a new sign-off),
// signs off security and export-control screening (rpc.screenResearchChallenge; publish only with both checks), and screens
// and decides partner proposals (rpc.decideResearchProposal). Auditors see everything read-only, with the audit trail.
import { useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { ResearchChallengesRow, ResearchProposalsRow, ResearchChallengeInput } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Card, Async, EmptyState, Callout, DataTable, StatusPill, Modal, ConfirmDialog, CheckboxField, TextField, TextArea, Icon, Tabs, Timeline } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { useThemeLabel } from './shared';

const BLANK: ResearchChallengeInput = { id: null, title_en: '', title_ar: '', theme: '', summary_en: '', summary_ar: '', closes_on: null };

export default function AdminResearchPage() {
  const t = useT();
  const s = useSession();
  const canAct = s.can('research', ['A']);
  return (
    <Page title={t('m10.routes.admin-research.title')} intro={t('m10.ar.intro')} wide>
      <Callout tone="info" title={t('m10.ar.ruleTitle')}>{t('m10.ar.ruleBody')}</Callout>
      {!canAct && <Callout tone="sim">{t('m10.ar.readOnly')}</Callout>}
      <Tabs
        tabs={[
          { id: 'challenges', label: t('m10.ar.tabChallenges'), content: <Challenges canAct={canAct} /> },
          { id: 'proposals', label: t('m10.ar.tabProposals'), content: <Proposals canAct={canAct} /> },
          { id: 'audit', label: t('m10.ar.tabAudit'), content: <AuditTrail /> },
        ]}
      />
    </Page>
  );
}

function Challenges({ canAct }: { canAct: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const theme = useThemeLabel();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery('research_challenges', () => repo.list('research_challenges', { order: [['status', 'asc']] }));
  const [edit, setEdit] = useState<ResearchChallengeInput | null>(null);
  const [screen, setScreen] = useState<ResearchChallengesRow | null>(null);
  const [sec, setSec] = useState(false);
  const [exp, setExp] = useState(false);
  const valid = (e: ResearchChallengeInput) => [e.title_en, e.title_ar, e.summary_en, e.summary_ar, e.theme].every((x) => x.trim().length >= 3);
  const save = async (submit: boolean) => {
    if (!edit) return;
    const r = await run(() => repo.rpc.saveResearchChallenge({ ...edit, submit }));
    if (r.ok) setEdit(null);
  };
  return (
    <Card title={t('m10.ar.tabChallenges')} actions={canAct ? <button className="btn-primary btn-sm" onClick={() => setEdit(BLANK)} data-testid="m10-new-challenge"><Icon name="plus" size={14} />{t('m10.ar.newChallenge')}</button> : undefined} padded={false}>
      <div className="p-3">
        <Async state={q} empty={<EmptyState title={t('m10.res.none')} />}>
          {(rows) => (
            <div data-testid="m10-admin-challenges">
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'title', header: t('m10.pr.title'), value: (r) => pick(r, 'title'), sortable: true, render: (r) => <span className="font-semibold">{pick(r, 'title')}</span> },
                  { key: 'theme', header: t('m10.res.theme'), value: (r) => theme(r.theme), sortable: true },
                  { key: 'status', header: t('m10.pr.status'), value: (r) => r.status, sortable: true, render: (r) => <StatusPill status={r.status}>{t(`m10.ch.st.${r.status}`)}</StatusPill> },
                  { key: 'checks', header: t('m10.ar.checks'), value: (r) => `${r.security_ok ? 'S' : '-'}${r.export_control_ok ? 'E' : '-'}`, render: (r) => <span className="flex gap-1"><StatusPill tone={r.security_ok ? 'ok' : 'neutral'}>{t('m10.ar.security')}</StatusPill><StatusPill tone={r.export_control_ok ? 'ok' : 'neutral'}>{t('m10.ar.export')}</StatusPill></span> },
                  { key: 'signed', header: t('m10.ar.signed'), value: (r) => r.screening_signed_at ?? '', render: (r) => f.date(r.screening_signed_at) },
                  { key: 'closes', header: t('m10.ar.closes'), value: (r) => r.closes_on ?? '', render: (r) => f.date(r.closes_on) },
                  {
                    key: 'act', header: '', csv: false,
                    render: (r) =>
                      canAct && r.status !== 'closed' ? (
                        <span className="flex gap-1">
                          <button className="btn-ghost btn-sm" onClick={() => setEdit({ id: r.id, title_en: r.title_en, title_ar: r.title_ar, theme: r.theme, summary_en: r.summary_en, summary_ar: r.summary_ar, closes_on: r.closes_on ?? null })}>{t('common.edit')}</button>
                          {r.status !== 'draft' && !r.is_published && <button className="btn-outline btn-sm" onClick={() => { setScreen(r); setSec(r.security_ok); setExp(r.export_control_ok); }} data-testid="m10-screen">{t('m10.ar.signOff')}</button>}
                          {r.status === 'draft' && <button className="btn-outline btn-sm" onClick={() => run(() => repo.rpc.saveResearchChallenge({ id: r.id, title_en: r.title_en, title_ar: r.title_ar, theme: r.theme, summary_en: r.summary_en, summary_ar: r.summary_ar, closes_on: r.closes_on ?? null, submit: true }))}>{t('m10.ar.toScreening')}</button>}
                        </span>
                      ) : null,
                  },
                ]}
              />
            </div>
          )}
        </Async>
      </div>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? t('m10.ar.editChallenge') : t('m10.ar.newChallenge')}
        size="lg"
        footer={
          edit && (
            <>
              <button className="btn-outline" onClick={() => setEdit(null)}>{t('common.cancel')}</button>
              <button className="btn-outline" disabled={!valid(edit)} onClick={() => save(false)}>{t('m10.ar.saveDraft')}</button>
              <button className="btn-primary" disabled={!valid(edit)} onClick={() => save(true)}>{t('m10.ar.saveScreen')}</button>
            </>
          )
        }
      >
        {edit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label={t('m10.ar.titleEn')} name="te" value={edit.title_en} onChange={(v) => setEdit({ ...edit, title_en: v })} required />
            <TextField label={t('m10.ar.titleAr')} name="ta" value={edit.title_ar} onChange={(v) => setEdit({ ...edit, title_ar: v })} required />
            <TextArea label={t('m10.ar.summaryEn')} name="se" value={edit.summary_en} onChange={(v) => setEdit({ ...edit, summary_en: v })} required />
            <TextArea label={t('m10.ar.summaryAr')} name="sa" value={edit.summary_ar} onChange={(v) => setEdit({ ...edit, summary_ar: v })} required />
            <TextField label={t('m10.res.theme')} name="theme" value={edit.theme} onChange={(v) => setEdit({ ...edit, theme: v })} required hint={t('m10.ar.themeHint')} />
            <TextField label={t('m10.ar.closes')} name="closes" type="date" value={edit.closes_on ?? ''} onChange={(v) => setEdit({ ...edit, closes_on: v || null })} />
            {edit.id && <div className="sm:col-span-2"><Callout tone="sim">{t('m10.ar.editWarning')}</Callout></div>}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={!!screen}
        onClose={() => setScreen(null)}
        title={t('m10.ar.signOffTitle')}
        consequence={screen ? t('m10.ar.signOffBody', { title: pick(screen, 'title') }) : ''}
        actingAs={t('m10.ar.asScreening')}
        confirmLabel={t('m10.ar.signOff')}
        onConfirm={async () => {
          if (screen) await run(() => repo.rpc.screenResearchChallenge(screen.id, sec, exp));
        }}
      >
        <div className="space-y-2">
          <CheckboxField label={t('m10.ar.securityCheck')} hint={t('m10.ar.securityHint')} checked={sec} onChange={setSec} />
          <CheckboxField label={t('m10.ar.exportCheck')} hint={t('m10.ar.exportHint')} checked={exp} onChange={setExp} />
          <p className="text-[12.5px] text-ink-2" aria-live="polite">{sec && exp ? t('m10.ar.willPublish') : t('m10.ar.wontPublish')}</p>
        </div>
      </ConfirmDialog>
    </Card>
  );
}

function Proposals({ canAct }: { canAct: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const q = useQuery(['research_proposals', 'organisations', 'research_challenges'], async () => {
    const [rows, orgs, chs] = await Promise.all([repo.list('research_proposals', { order: [['submitted_at', 'desc']] }), repo.list('organisations'), repo.list('research_challenges')]);
    return rows.map((r) => ({ ...r, orgName: pick(orgs.find((o) => o.id === r.org_id), 'name') || r.org_id, ch: r.challenge_id ? pick(chs.find((c) => c.id === r.challenge_id), 'title') : t('m10.pr.open') }));
  });
  const [act, setAct] = useState<{ r: ResearchProposalsRow; decision: 'screening' | 'accepted' | 'declined' } | null>(null);
  const [sec, setSec] = useState(false);
  const [view, setView] = useState<(ResearchProposalsRow & { orgName: string; ch: string }) | null>(null);
  return (
    <Card title={t('m10.ar.tabProposals')} padded={false}>
      <div className="p-3">
        <Async state={q} empty={<EmptyState title={t('m10.pr.none')} />}>
          {(rows) => (
            <div data-testid="m10-admin-proposals">
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                onRowClick={setView}
                columns={[
                  { key: 'title', header: t('m10.pr.title'), value: (r) => r.title, sortable: true, render: (r) => <span className="font-semibold">{r.title}</span> },
                  { key: 'org', header: t('m10.ar.organisation'), value: (r) => r.orgName, sortable: true },
                  { key: 'ch', header: t('m10.pr.challenge'), value: (r) => r.ch },
                  { key: 'status', header: t('m10.pr.status'), value: (r) => r.status, sortable: true, render: (r) => <StatusPill status={r.status === 'accepted' ? 'approved' : r.status}>{t(`m10.pr.st.${r.status}`)}</StatusPill> },
                  { key: 'screened', header: t('m10.pr.screened'), value: (r) => (r.screened ? 'yes' : 'no'), render: (r) => (r.screened ? <StatusPill tone="ok">{t('common.yes')}</StatusPill> : t('common.no')) },
                  { key: 'sub', header: t('m10.pr.submitted'), value: (r) => r.submitted_at ?? '', sortable: true, render: (r) => f.date(r.submitted_at) },
                  {
                    key: 'act', header: '', csv: false,
                    render: (r) =>
                      canAct && ['submitted', 'screening'].includes(r.status) ? (
                        <span className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                          {r.status === 'submitted' && <button className="btn-ghost btn-sm" onClick={() => { setSec(false); setAct({ r, decision: 'screening' }); }}>{t('m10.ar.startScreening')}</button>}
                          <button className="btn-outline btn-sm" onClick={() => { setSec(r.screened); setAct({ r, decision: 'accepted' }); }} data-testid="m10-accept">{t('m10.ar.accept')}</button>
                          <button className="btn-ghost btn-sm text-bad" onClick={() => { setSec(r.screened); setAct({ r, decision: 'declined' }); }}>{t('m10.ar.decline')}</button>
                        </span>
                      ) : null,
                  },
                ]}
              />
            </div>
          )}
        </Async>
      </div>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title ?? ''} size="lg">
        {view && (
          <div className="space-y-2 text-[13.5px]">
            <div className="caps">{view.orgName} · {view.ch}</div>
            <p className="whitespace-pre-wrap">{view.summary}</p>
            <p className="text-ink-3">{t('m10.pr.ip')}: {view.ip_route ?? '—'}</p>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={!!act}
        onClose={() => setAct(null)}
        danger={act?.decision === 'declined'}
        requireReason={act?.decision !== 'screening'}
        reasonLabel={t('m10.ar.note')}
        title={act ? t(`m10.ar.decide.${act.decision}`) : ''}
        consequence={act ? t(`m10.ar.decideBody.${act.decision}`, { title: act.r.title }) : ''}
        actingAs={t('m10.ar.asScreening')}
        onConfirm={async (note) => {
          if (act) await run(() => repo.rpc.decideResearchProposal(act.r.id, act.decision, sec, note));
        }}
      >
        {act && act.decision !== 'declined' && !act.r.screened && (
          <CheckboxField label={t('m10.ar.proposalScreen')} hint={t('m10.ar.proposalScreenHint')} checked={sec} onChange={setSec} />
        )}
      </ConfirmDialog>
    </Card>
  );
}

function AuditTrail() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const q = useQuery('audit_events', () => repo.list('audit_events', { filter: { action: { ilike: 'research.%' } }, order: [['seq', 'desc']], limit: 50 }));
  return (
    <Card title={t('m10.ar.auditTitle')}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m10.ar.auditHint')}</p>
      <Async state={q} empty={<EmptyState title={t('m10.ar.noAudit')} />}>
        {(rows) => (
          <div data-testid="m10-audit">
            <Timeline items={rows.map((e) => ({ id: e.id, when: `#${e.seq} · ${f.dateTime(e.ts)}`, title: `${e.action} · ${e.entity_id ?? ''}`, detail: `${e.outcome}${e.actor_role ? ` · ${e.actor_role}` : ''}${e.reason ? ` · ${e.reason}` : ''}`, tone: e.outcome === 'ok' ? 'ok' : 'bad' }))} />
          </div>
        )}
      </Async>
    </Card>
  );
}

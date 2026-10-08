// M10 /partner/research: a partner organisation (supplier, international partner or university) responds to published
// challenges or proposes open research, chooses the IP route and follows screening. Saves and submissions go through
// rpc.saveResearchProposal; the organisation never marks its own proposal screened or accepted.
import { useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { ResearchProposalsRow } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, DataTable, StatusPill, Modal, ConfirmDialog, SelectField, TextField, TextArea, Icon, Stepper } from '../../ui';
import { useFormat, usePick, useT } from '../../i18n';
import { ChallengeCard, IP_ROUTES, IP_ROUTE_VALUE, MoetLink } from './shared';

type Draft = { id: string | null; challenge_id: string; title: string; summary: string; ip: (typeof IP_ROUTES)[number] };
const STEPS = ['draft', 'submitted', 'screening', 'decided'];

export default function PartnerResearchPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const canWrite = s.can('research', ['OrgW']);
  const challenges = useQuery('research_challenges', () => repo.list('research_challenges', { filter: { is_published: true }, order: [['closes_on', 'asc']] }));
  const proposals = useQuery('research_proposals', () => repo.list('research_proposals', { order: [['submitted_at', 'desc']] }));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<Draft | null>(null);
  const [submitRow, setSubmitRow] = useState<ResearchProposalsRow | null>(null);
  const chName = (id: string | null | undefined) => (id ? pick(challenges.data?.find((c) => c.id === id), 'title') || id : t('m10.pr.open'));
  const errors = (d: Draft) => ({ title: d.title.trim().length < 5 || d.title.length > 200, summary: d.summary.trim().length < 20 || d.summary.length > 4000 });
  const save = async (d: Draft, submit: boolean) => {
    const r = await run(() => repo.rpc.saveResearchProposal({ id: d.id, challenge_id: d.challenge_id || null, title: d.title, summary: d.summary, ip_route: IP_ROUTE_VALUE[d.ip], submit }));
    if (r.ok) setDraft(null);
    return r.ok;
  };
  const open = (p?: ResearchProposalsRow, challenge?: string) =>
    setDraft(p ? { id: p.id, challenge_id: p.challenge_id ?? '', title: p.title, summary: p.summary, ip: p.ip_route === IP_ROUTE_VALUE.none ? 'none' : 'moet' } : { id: null, challenge_id: challenge ?? '', title: '', summary: '', ip: 'moet' });

  return (
    <Page title={t('m10.routes.partner-research.title')} intro={t('m10.pr.intro')} wide actions={canWrite ? <button className="btn-primary btn-sm" onClick={() => open()} data-testid="m10-new-proposal"><Icon name="plus" size={14} />{t('m10.pr.new')}</button> : undefined}>
      <Callout tone="sim" title={t('m10.pr.safeTitle')}>{t('m10.pr.safeBody')}</Callout>
      <Section title={t('m10.pr.mineTitle')} description={t('m10.pr.mineHint')}>
        <Async state={proposals} empty={<EmptyState title={t('m10.pr.none')} action={canWrite ? <button className="btn-outline btn-sm" onClick={() => open()}>{t('m10.pr.new')}</button> : undefined} />}>
          {(rows) => (
            <div data-testid="m10-proposals">
              <DataTable
                rows={rows}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'title', header: t('m10.pr.title'), value: (r) => r.title, sortable: true, render: (r) => <span className="font-semibold">{r.title}</span> },
                  { key: 'ch', header: t('m10.pr.challenge'), value: (r) => chName(r.challenge_id) },
                  { key: 'status', header: t('m10.pr.status'), value: (r) => r.status, render: (r) => <StatusPill status={r.status === 'accepted' ? 'approved' : r.status}>{t(`m10.pr.st.${r.status}`)}</StatusPill> },
                  { key: 'screened', header: t('m10.pr.screened'), value: (r) => (r.screened ? 'yes' : 'no'), render: (r) => (r.screened ? <StatusPill tone="ok">{t('common.yes')}</StatusPill> : <span className="text-ink-3">{t('common.no')}</span>) },
                  { key: 'ip', header: t('m10.pr.ip'), value: (r) => (r.ip_route === IP_ROUTE_VALUE.none ? t('m10.ip.none') : t('m10.ip.moet')) },
                  { key: 'sub', header: t('m10.pr.submitted'), value: (r) => r.submitted_at ?? '', sortable: true, render: (r) => f.date(r.submitted_at) },
                  {
                    key: 'act', header: '', csv: false,
                    render: (r) =>
                      canWrite && r.status === 'draft' ? (
                        <span className="flex gap-1">
                          <button className="btn-ghost btn-sm" onClick={() => open(r)}>{t('common.edit')}</button>
                          <button className="btn-outline btn-sm" onClick={() => setSubmitRow(r)} data-testid="m10-submit-proposal">{t('m10.pr.submit')}</button>
                        </span>
                      ) : null,
                  },
                ]}
              />
            </div>
          )}
        </Async>
        <Card>
          <Stepper current={-1} steps={STEPS.map((x) => ({ id: x, label: t(`m10.pr.step.${x}`) }))} />
          <p className="mt-2 text-[12.5px] text-ink-3">{t('m10.pr.stepsNote')}</p>
        </Card>
      </Section>

      <Section title={t('m10.pr.challengesTitle')} description={t('m10.pr.challengesHint')}>
        <Async state={challenges} empty={<EmptyState title={t('m10.res.none')} />}>
          {(rows) => (
            <Grid cols={3}>
              {rows.map((c) => (
                <ChallengeCard key={c.id} c={c} action={canWrite ? <button className="btn-outline btn-sm" onClick={() => open(undefined, c.id)}>{t('m10.pr.respond')}</button> : undefined} />
              ))}
            </Grid>
          )}
        </Async>
      </Section>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('m10.pr.edit') : t('m10.pr.new')}
        size="lg"
        footer={
          draft && (
            <>
              <button className="btn-outline" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
              <button className="btn-outline" disabled={errors(draft).title || errors(draft).summary} onClick={() => save(draft, false)} data-testid="m10-save-draft">{t('m10.pr.saveDraft')}</button>
              <button className="btn-primary" disabled={errors(draft).title || errors(draft).summary} onClick={() => setConfirm(draft)}>{t('m10.pr.submit')}</button>
            </>
          )
        }
      >
        {draft && (
          <div className="space-y-3" data-testid="m10-proposal-form">
            <SelectField label={t('m10.pr.challenge')} name="ch" value={draft.challenge_id} onChange={(v) => setDraft({ ...draft, challenge_id: v })} placeholder={t('m10.pr.open')} options={(challenges.data ?? []).map((c) => ({ value: c.id, label: pick(c, 'title') }))} />
            <TextField label={t('m10.pr.title')} name="title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} required error={draft.title && errors(draft).title ? 'common.validation.minLen:5' : null} />
            <TextArea label={t('m10.pr.summary')} name="summary" rows={6} value={draft.summary} onChange={(v) => setDraft({ ...draft, summary: v })} required hint={t('m10.pr.summaryHint', { n: draft.summary.length })} error={draft.summary && errors(draft).summary ? 'common.validation.minLen:20' : null} />
            <SelectField label={t('m10.pr.ip')} name="ip" value={draft.ip} onChange={(v) => setDraft({ ...draft, ip: (v || 'moet') as Draft['ip'] })} options={IP_ROUTES.map((x) => ({ value: x, label: t(`m10.ip.${x}`) }))} hint={t('m10.pr.ipHint')} />
            <MoetLink />
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t('m10.pr.confirmTitle')}
        consequence={t('m10.pr.confirmBody')}
        actingAs={t('m10.pr.asPartner')}
        confirmLabel={t('m10.pr.submit')}
        onConfirm={async () => {
          if (confirm) await save(confirm, true);
        }}
      />
      <ConfirmDialog
        open={!!submitRow}
        onClose={() => setSubmitRow(null)}
        title={t('m10.pr.confirmTitle')}
        consequence={t('m10.pr.confirmBody')}
        actingAs={t('m10.pr.asPartner')}
        confirmLabel={t('m10.pr.submit')}
        onConfirm={async () => {
          if (submitRow) await save({ id: submitRow.id, challenge_id: submitRow.challenge_id ?? '', title: submitRow.title, summary: submitRow.summary, ip: submitRow.ip_route === IP_ROUTE_VALUE.none ? 'none' : 'moet' }, true);
        }}
      />
    </Page>
  );
}

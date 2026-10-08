// Record a performance evaluation (OJT, JPM-based or simulator form) for a candidate: rpc.recordPerformance.
// Shared by /training/schedule (M04) and /training/assessments (M05).
import { Modal, Icon, TextField, TextArea, SelectField, useForm, required, numberRange } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useT } from '../../i18n';

export function PerformanceModal({ formId, personId, name, onClose }: { formId: string; personId: string; name: string; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const form = useForm({ result: 'pass', score: '', note: '' }, { result: [required()], score: [numberRange(0, 100)], note: [required()] });
  return (
    <Modal open onClose={onClose} title={t('m04.schedule.perfTitle', { name })} footer={<><button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button><button className="btn-primary" type="submit" form="m04-perf-form" disabled={form.submitting}>{t('m04.schedule.record')}</button></>}>
      <form id="m04-perf-form" className="space-y-3" onSubmit={form.handleSubmit(async (v) => {
        const r = await run(() => repo.rpc.recordPerformance(formId, personId, v.result === 'pass', v.score ? Number(v.score) : null, v.note.trim()));
        if (r.ok) onClose();
      })}>
        <SelectField label={t('m04.common.result')} required options={[{ value: 'pass', label: t('m04.status.passed') }, { value: 'fail', label: t('m04.status.failed') }]} {...form.field('result')} />
        <TextField label={t('m04.schedule.score')} type="number" {...form.field('score')} />
        <TextArea label={t('m04.schedule.evidence')} required hint={t('m04.schedule.evidenceHint')} rows={3} {...form.field('note')} />
        <p className="flex items-start gap-2 rounded-btn border border-info-line bg-info-bg p-2.5 text-[12.5px] text-info"><Icon name="shield" size={14} className="mt-0.5" />{t('common.evidenceRecorded')}</p>
      </form>
    </Modal>
  );
}

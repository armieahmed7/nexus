// F16: the line manager's nomination dialog (shared by the programme page and the nominations desk). The people list is what the
// repository returns for the manager's scope; the RPC re-checks scope, self-nomination and duplicates (maker-checker decides later).
import { useState } from 'react';
import { Modal, Callout, SelectField, Icon } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { usePick, useT } from '../../i18n';
import type { Programme } from './ui';

export function NominateModal({ open, onClose, programmes, fixedProgramme }: { open: boolean; onClose: () => void; programmes: Programme[]; fixedProgramme?: string }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const me = s.identity.personId;
  const team = useQuery(['people'], () => repo.list('people', { filter: { kind: 'staff', status: 'active' }, order: [['display_name', 'asc']] }).catch(() => []), [me]);
  const [person, setPerson] = useState('');
  const [prog, setProg] = useState(fixedProgramme ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const people = (team.data ?? []).filter((p) => p.id !== me);
  const valid = person && (fixedProgramme ?? prog) && reason.trim().length >= 10 && reason.trim().length <= 500;
  const nominable = programmes.filter((g) => g.nominable);
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={t('m22.nominate.title')}
      footer={<>
        <button className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!valid || busy} data-testid="m22-nominate-confirm" onClick={async () => {
          setBusy(true);
          try {
            const r = await run(() => repo.rpc.nominateLeader(person, fixedProgramme ?? prog, reason.trim()));
            if (r.ok) { setPerson(''); setReason(''); onClose(); }
          } finally { setBusy(false); }
        }}><Icon name="check" size={14} />{busy ? t('common.working') : t('m22.nominate.send')}</button>
      </>}>
      <div className="space-y-3">
        <SelectField label={t('m22.nominate.person')} name="m22-person" value={person} onChange={setPerson} placeholder={t('common.choose')}
          options={people.map((p) => ({ value: p.id, label: `${pick({ name_en: p.display_name, name_ar: p.display_name_ar || p.display_name }, 'name')}${p.crew ? ` · ${t('m22.nominate.crew', { crew: p.crew })}` : ''}` }))} />
        {people.length === 0 && <p className="text-[12.5px] text-ink-3">{t('m22.nominate.noTeam')}</p>}
        {!fixedProgramme && (
          <SelectField label={t('m22.nominate.programme')} name="m22-programme" value={prog} onChange={setProg} placeholder={t('common.choose')}
            options={nominable.map((g) => ({ value: g.id, label: pick(g, 'title') }))} />
        )}
        <label className="block">
          <span className="caps">{t('m22.nominate.reason')}</span>
          <textarea className="input mt-1" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="m22-nominate-reason" />
          <span className="text-[12px] text-ink-3">{t('m22.nominate.reasonHint')}</span>
        </label>
        <Callout title={t('m22.nominate.makerChecker')}>{t('m22.nominate.makerCheckerBody')}</Callout>
      </div>
    </Modal>
  );
}

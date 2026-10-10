// F03 /my/skills: my Skills Passport. Own skill state with evidence, claims, radar, strengths and exports.
// Managers and instructors (skills_profile Scope) also get a picker for the passports of the people in their scope.
import { useState } from 'react';
import { Page, Async, Card, SelectField, Icon } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useT, usePick, L, useNav } from '../../i18n';
import { useSession } from '../../auth/session';
import { PassportView, useExportModel, usePassportModel, downloadPassportJson } from './PassportView';
import { usePassportData, type PassportData } from './ui';

export default function MySkillsPage() {
  const t = useT();
  const s = useSession();
  const me = s.identity.personId;
  const q = usePassportData(me);
  return (
    <Page title={t('m17.routes.my-skills.title')} intro={t('m17.passport.intro')} actions={q.data ? <Exports d={q.data} /> : undefined}>
      {s.can('skills_profile', ['Scope', 'A']) && <TeamPicker me={me} />}
      <Async state={q}>{(d) => <PassportView d={d} />}</Async>
    </Page>
  );
}

function Exports({ d }: { d: PassportData }) {
  const t = useT();
  const vm = usePassportModel(d);
  const model = useExportModel(d, vm);
  return (
    <div className="flex flex-wrap gap-2">
      <L to="/my/skills/checkins" className="btn-outline btn-sm no-underline" data-testid="m17-to-checkins">
        <Icon name="users" size={14} /> {t('m17.ci.toCheckins')}
      </L>
      <L to="/my/skills/confidence" className="btn-outline btn-sm no-underline" data-testid="m17-to-confidence">
        <Icon name="chart" size={14} /> {t('m17.dk.howSureLink')}
      </L>
      <L to="/my/skills/wallet" className="btn-outline btn-sm no-underline" data-testid="m17-to-wallet">
        <Icon name="shield" size={14} /> {t('m17.passport.wallet')}
      </L>
      <L to="/my/skills/print" className="btn-outline btn-sm no-underline" data-testid="m17-print">
        <Icon name="book" size={14} /> {t('m17.passport.print')}
      </L>
      <button type="button" className="btn-outline btn-sm" onClick={() => downloadPassportJson(model)} data-testid="m17-json">
        <Icon name="download" size={14} /> {t('m17.passport.json')}
      </button>
    </div>
  );
}

function TeamPicker({ me }: { me: string | null }) {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const nav = useNav();
  const [who, setWho] = useState('');
  const people = useQuery(['people'], () => repo.list('people', { filter: { kind: 'staff' }, order: [['display_name', 'asc']] }), []);
  const list = (people.data ?? []).filter((p) => p.id !== me);
  if (!list.length) return null;
  return (
    <Card title={t('m17.team.pickTitle')} eyebrow={t('m17.team.pickEyebrow')}>
      <div className="flex flex-wrap items-end gap-2" data-testid="m17-team-picker">
        <div className="min-w-[260px] flex-1">
          <SelectField label={t('m17.team.person')} name="who" value={who} onChange={setWho} placeholder={t('common.choose')}
            options={list.map((p) => ({ value: p.id, label: `${pick(p, 'display_name')} · ${p.job_role_id ?? ''}` }))} />
        </div>
        <button type="button" className="btn-primary" disabled={!who} onClick={() => nav(`/team/passport/${who}`)}>{t('m17.team.open')}</button>
        <L to="/team/skills" className="btn-outline no-underline" data-testid="m17-to-team-skills">{t('m17.tm.toHeatmap')}</L>
      </div>
    </Card>
  );
}

// /opportunities/rotations/shadow (M20 · F15): ask to shadow a colleague for 1 to 5 days. Hosts opt in through the host directory;
// each request needs the host's and the line manager's consent. Hosts are ranked by the skills they offer that I want to grow
// (useEngine('match') + <WhyThis>). I can also offer to host. Security, cyber and safeguards work is never shadowed.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, WhyThis, EngineBadge, Icon, ConfirmDialog, FilterBar, useFilters } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { L, useFormat, usePick, useT } from '../../i18n';
import { MatchRing } from './ui';
import { rankHosts } from './rotationMatch';
import { HOST_MAX_SKILLS, RESTRICTED_FAMILIES, RESTRICTED_SKILL_AREAS, SHADOW_MAX_DAYS, SHADOW_MAX_SKILLS, addDays } from './rotation';
import { useRotations, useRotLabels, targetOf, SiteChip, todayIso, type RotData, type Host } from './rotUi';

export default function ShadowPage() {
  const t = useT();
  const { q, me, person } = useRotations();
  return (
    <Page title={t('m20.routes.rotations-shadow.title')} intro={t('m20.rot.shadow.intro')} wide
      actions={<L to="/opportunities/rotations/my?tab=shadow" className="btn-outline btn-sm"><Icon name="user" size={14} />{t('m20.rot.shadow.mine')}</L>}>
      <Async state={q} isEmpty={() => false}>{(d) => <Shadow d={d} me={me} currentRole={person?.job_role_id ?? null} family={person?.job_family_id ?? null} />}</Async>
    </Page>
  );
}

type Flt = { q: string; family: string; skill: string };

function Shadow({ d, me, currentRole, family }: { d: RotData; me: string | null; currentRole: string | null; family: string | null }) {
  const t = useT();
  const pick = usePick();
  const lab = useRotLabels(d);
  const eng = useEngine('match');
  const [flt, setFlt] = useFilters<Flt>({ q: '', family: '', skill: '' });
  const [sel, setSel] = useState<string | null>(null);
  const target = targetOf(d, currentRole);
  const ranked = useMemo(() => rankHosts(d.hosts.filter((h) => h.active && h.listed), me, { states: d.states, skills: d.skills, roleComps: d.roleComps, targetRole: target, family, roleLabels: lab.roleLabels, familyLabels: lab.familyLabels }, flt.skill ? [flt.skill] : []),
    [d, me, target, family, flt.skill]); // eslint-disable-line react-hooks/exhaustive-deps
  const term = flt.q.trim().toLowerCase();
  const list = ranked.filter((r) => {
    const h = r.item!.host;
    if (flt.family && h.family_id !== flt.family) return false;
    if (flt.skill && !h.skill_ids.includes(flt.skill)) return false;
    if (term && !`${h.name} ${h.name_ar} ${h.skill_ids.map(lab.skill).join(' ')} ${lab.role(h.role_id)}`.toLowerCase().includes(term)) return false;
    return true;
  });
  const host = d.hosts.find((h) => h.id === sel) ?? null;
  const offered = [...new Set(d.hosts.filter((h) => h.listed).flatMap((h) => h.skill_ids))];
  const fams = [...new Set(d.hosts.filter((h) => h.listed).map((h) => h.family_id).filter(Boolean) as string[])];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Section title={t('m20.rot.shadow.directory')} description={t('m20.rot.shadow.directorySub', { role: target ? lab.role(target) : t('m20.rot.hub.noTarget') })} actions={<EngineBadge engine={eng} />}>
          <FilterBar value={flt} onChange={setFlt} search="q" fields={[
            { key: 'family', label: t('m20.rot.shadow.family'), options: fams.map((x) => ({ value: x, label: lab.family(x) })) },
            { key: 'skill', label: t('m20.rot.shadow.skill'), options: offered.map((x) => ({ value: x, label: lab.skill(x) })) },
          ]} />
          {list.length === 0 ? <EmptyState icon="users" title={t('m20.rot.shadow.noHosts')} /> : (
            <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m20-rot-hosts">
              {list.map((r) => {
                const h = r.item!.host;
                const active = sel === h.id;
                return (
                  <li key={h.id} className={`card p-3 ${active ? 'border-accent ring-2 ring-accent/30' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{pick({ name_en: h.name, name_ar: h.name_ar }, 'name')}</div>
                        <div className="text-[12.5px] text-ink-3">{lab.role(h.role_id)} · {lab.family(h.family_id)}</div>
                      </div>
                      <MatchRing score={r.score} size={44} />
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">{h.skill_ids.map((s) => <li key={s} className={`chip ${r.item!.growth.includes(s) ? 'border-accent/30 bg-accent-soft text-eyebrow' : 'border-line bg-sunken text-ink-2'}`}>{lab.skill(s)}</li>)}</ul>
                    {pick(h, 'note') && <p className="mt-2 text-[12.5px] text-ink-2">{pick(h, 'note')}</p>}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><WhyThis reasons={r.reasons} testId="m20-rot-host-why" />{h.site_induction && <SiteChip />}</div>
                      <button className={active ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={active} onClick={() => setSel(h.id)} data-testid="m20-rot-pick-host">{active ? t('m20.rot.shadow.selected') : t('m20.rot.shadow.choose')}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <div className="space-y-4">
          <RequestForm d={d} host={host} me={me} />
          <HostProfile d={d} me={me} family={family} />
        </div>
      </div>
      <Callout tone="sim" title={t('m20.rot.shadow.rulesTitle')}>{t('m20.rot.shadow.rulesBody')}</Callout>
    </div>
  );
}

function RequestForm({ d, host, me }: { d: RotData; host: Host | null; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lab = useRotLabels(d);
  const repo = useRepo();
  const run = useAction();
  const today = todayIso();
  const [skills, setSkills] = useState<string[]>([]);
  const [start, setStart] = useState(addDays(today, 14));
  const [days, setDays] = useState(2);
  const [purpose, setPurpose] = useState('');
  const [confirm, setConfirm] = useState(false);
  const open = d.shadows.filter((r) => r.person_id === me && (r.status === 'requested' || r.status === 'approved')).length;
  if (!host) return <Card title={t('m20.rot.shadow.request')}><EmptyState icon="users" title={t('m20.rot.shadow.pickFirst')}>{t('m20.rot.shadow.pickFirstBody')}</EmptyState></Card>;
  const chosen = skills.filter((s) => host.skill_ids.includes(s));
  const valid = chosen.length >= 1 && chosen.length <= SHADOW_MAX_SKILLS && purpose.trim().length >= 10 && purpose.trim().length <= 500 && start >= today;
  return (
    <Card title={t('m20.rot.shadow.requestWith', { name: pick({ name_en: host.name, name_ar: host.name_ar }, 'name') })} className="border-accent/40">
      <div className="space-y-3" data-testid="m20-rot-request-form">
        <fieldset>
          <legend className="caps mb-1">{t('m20.rot.shadow.skills', { n: SHADOW_MAX_SKILLS })}</legend>
          <div className="flex flex-wrap gap-1.5">
            {host.skill_ids.map((s) => {
              const on = chosen.includes(s);
              return <button key={s} type="button" aria-pressed={on} className={`btn-sm ${on ? 'btn-primary' : 'btn-outline'}`} disabled={!on && chosen.length >= SHADOW_MAX_SKILLS} onClick={() => setSkills((c) => (on ? c.filter((x) => x !== s) : [...c, s]))}>{lab.skill(s)}</button>;
            })}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="caps">{t('m20.rot.shadow.start')}</span><input type="date" className="input mt-1" min={today} max={addDays(today, 180)} value={start} onChange={(e) => setStart(e.target.value)} data-testid="m20-rot-start" /></label>
          <label className="block"><span className="caps">{t('m20.rot.shadow.days')}</span>
            <select className="input mt-1" value={days} onChange={(e) => setDays(Number(e.target.value))} data-testid="m20-rot-days">
              {Array.from({ length: SHADOW_MAX_DAYS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('m20.rot.common.days', { n: f.num(n) })}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><span className="caps">{t('m20.rot.shadow.purpose')}</span><textarea className="input mt-1" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('m20.rot.shadow.purposeHint')} data-testid="m20-rot-purpose" /></label>
        {host.site_induction && <p className="flex items-center gap-2 text-[12.5px] text-ink-2"><SiteChip />{t('m20.rot.common.siteHint')}</p>}
        <p className="text-[12.5px] text-ink-3">{t('m20.rot.shadow.consentNote', { n: f.num(open) })}</p>
        <button className="btn-primary w-full" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m20-rot-request">{t('m20.rot.shadow.send')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m20.rot.shadow.confirmTitle')} consequence={t('m20.rot.shadow.confirmBody', { n: f.num(days), d: f.date(start) })} confirmLabel={t('m20.rot.shadow.send')}
        onConfirm={async () => { const r = await run(() => repo.rpc.requestShadow({ host_id: host.person_id, start_on: start, days, skill_ids: chosen, purpose: purpose.trim() })); if (r.ok) { setPurpose(''); setSkills([]); } }} />
    </Card>
  );
}

function HostProfile({ d, me, family }: { d: RotData; me: string | null; family: string | null }) {
  const t = useT();
  const lab = useRotLabels(d);
  const repo = useRepo();
  const run = useAction();
  const mine = d.hosts.find((h) => h.person_id === me) ?? null;
  const [skills, setSkills] = useState<string[]>(mine?.skill_ids ?? []);
  const [daysM, setDaysM] = useState(mine?.max_days_month ?? 2);
  const [noteEn, setNoteEn] = useState(mine?.note_en ?? '');
  const [noteAr, setNoteAr] = useState(mine?.note_ar ?? '');
  const [edit, setEdit] = useState(false);
  if (family && RESTRICTED_FAMILIES.includes(family)) return <Card title={t('m20.rot.shadow.offer')}><p className="text-[13px] text-ink-2">{t('m20.rot.shadow.restrictedHost')}</p></Card>;
  const catalogue = d.skills.filter((s) => !RESTRICTED_SKILL_AREAS.includes(s.area));
  const valid = skills.length >= 1 && skills.length <= HOST_MAX_SKILLS && noteEn.length <= 300 && noteAr.length <= 300;
  return (
    <Card title={t('m20.rot.shadow.offer')} actions={mine?.active ? <span className="chip border-ok-line bg-ok-bg text-ok">{t('m20.rot.shadow.listed')}</span> : null}>
      {!edit ? (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-2">{mine?.active ? t('m20.rot.shadow.offerOn', { n: mine.skill_ids.length }) : t('m20.rot.shadow.offerOff')}</p>
          {mine?.active && <ul className="flex flex-wrap gap-1.5">{mine.skill_ids.map((s) => <li key={s} className="chip border-line bg-sunken text-ink-2">{lab.skill(s)}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={() => setEdit(true)} data-testid="m20-rot-host-edit">{mine?.active ? t('m20.rot.shadow.editOffer') : t('m20.rot.shadow.startOffer')}</button>
            {mine?.active && <button className="btn-ghost btn-sm" onClick={() => run(() => repo.rpc.setShadowHost({ active: false, skill_ids: mine.skill_ids, max_days_month: mine.max_days_month }))}>{t('m20.rot.shadow.stopOffer')}</button>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block"><span className="caps">{t('m20.rot.shadow.offerSkills', { n: HOST_MAX_SKILLS })}</span>
            <select className="input mt-1" value="" onChange={(e) => { const v = e.target.value; if (v && !skills.includes(v) && skills.length < HOST_MAX_SKILLS) setSkills([...skills, v]); }}>
              <option value="">{t('m20.rot.shadow.addSkill')}</option>
              {catalogue.filter((s) => !skills.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{lab.skill(s.id)}</option>)}
            </select>
          </label>
          <ul className="flex flex-wrap gap-1.5">{skills.map((s) => <li key={s}><button type="button" className="chip border-accent/30 bg-accent-soft text-eyebrow" onClick={() => setSkills(skills.filter((x) => x !== s))} aria-label={t('m20.rot.shadow.removeSkill', { s: lab.skill(s) })}>{lab.skill(s)} <Icon name="close" size={10} /></button></li>)}</ul>
          <label className="block"><span className="caps">{t('m20.rot.shadow.daysMonth')}</span><input type="number" min={1} max={10} className="input mt-1" value={daysM} onChange={(e) => setDaysM(Number(e.target.value))} /></label>
          <label className="block"><span className="caps">{t('m20.rot.shadow.noteEn')}</span><input className="input mt-1" value={noteEn} onChange={(e) => setNoteEn(e.target.value)} maxLength={300} /></label>
          <label className="block"><span className="caps">{t('m20.rot.shadow.noteAr')}</span><input className="input mt-1" dir="rtl" value={noteAr} onChange={(e) => setNoteAr(e.target.value)} maxLength={300} /></label>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={!valid} onClick={async () => { const r = await run(() => repo.rpc.setShadowHost({ active: true, skill_ids: skills, max_days_month: daysM, note_en: noteEn, note_ar: noteAr })); if (r.ok) setEdit(false); }} data-testid="m20-rot-host-save">{t('m20.rot.shadow.saveOffer')}</button>
            <button className="btn-ghost btn-sm" onClick={() => setEdit(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </Card>
  );
}

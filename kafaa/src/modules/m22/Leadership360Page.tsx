// /leadership/360 (M22 · F16): leadership behaviours 360. My results appear only as aggregates and only once at least five
// colleagues responded (self excluded); otherwise "not enough responses". I can ask 5 to 12 colleagues, rate myself, and give the
// feedback I was asked for. Ratings are stored without the rater's identity; nobody (not HR, not admins) reads individual answers.
// FS46 (fsEe4): each request carries its form version (new cycles use form 2 with the four future behaviours; cycles already started
// and older results stay on form 1 and remain readable); the sheet shows the anchor of every rating point in the reader's language.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, Tabs, ProgressBar, ConfirmDialog, Icon, StatTile, Grid, BenchmarkChips, StatusPill } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BEHAVIOURS, CURRENT_FORM_VERSION, MAX_360_INVITES, MIN_360_RATERS, RATER_KINDS, formBehaviours, type My360 } from './domain';
import { useAnchor, useBehaviours } from './fsui';
import { M22Pill, usePersonName } from './ui';

export default function Leadership360Page() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const [cycle, setCycle] = useState<string | null>(null);
  const mine = useQuery(['leadership_360_requests', 'leadership_360'], () => repo.rpc.my360(cycle), [me, cycle]);
  const inbox = useQuery(['leadership_360_requests'], () => repo.list('leadership_360_requests', { order: [['invited_at', 'desc']] }), [me]);
  const traits = useQuery(['sc_traits'], () => repo.list('sc_traits').catch(() => []), []);
  const pending = (inbox.data ?? []).filter((x) => x.status === 'invited' && x.subject_id !== me).length;
  return (
    <Page title={t('m22.routes.leadership-360.title')} intro={t('m22.r360.intro')} eyebrow={<L to="/leadership">{t('m22.programme.back')}</L>} wide
      actions={<L to="/leadership/behaviours" className="btn-outline btn-sm" data-testid="m22-360-behaviours"><Icon name="sparkle" size={14} />{t('m22.r360.behavioursLink')}</L>}>
      <div className="mb-4"><BenchmarkChips feature="FS46" /></div>
      <Tabs tabs={[
        { id: 'results', label: t('m22.r360.tabResults'), content: <Async state={mine}>{(d) => <Results d={d} traits={traits.data ?? []} onCycle={setCycle} />}</Async> },
        { id: 'give', label: t('m22.r360.tabGive'), badge: pending ? <span className="chip border-info-line bg-info-bg text-info">{pending}</span> : undefined, content: <Async state={inbox}>{(rows) => <Give rows={rows} me={me} />}</Async> },
        { id: 'request', label: t('m22.r360.tabRequest'), content: <Async state={mine}>{(d) => <Request d={d} me={me} />}</Async> },
      ]} />
      <div className="mt-6"><Callout title={t('m22.r360.privacyTitle')}>{t('m22.r360.privacyBody', { n: MIN_360_RATERS })}</Callout></div>
    </Page>
  );
}

function Results({ d, traits, onCycle }: { d: My360; traits: { id: string; name_en: string; name_ar: string }[]; onCycle: (c: string) => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  if (!d.cycle) return <EmptyState icon="users" title={t('m22.r360.noCycle')}>{t('m22.r360.noCycleBody')}</EmptyState>;
  return (
    <div className="space-y-5 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="caps">{t('m22.r360.cycle')}</span>
        {d.cycles.map((c) => <button key={c} className={`chip ${c === d.cycle ? 'border-accent bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`} onClick={() => onCycle(c)} aria-pressed={c === d.cycle}>{c}</button>)}
        <span data-testid="m22-360-form-version"><StatusPill tone={d.form_version === 2 ? 'accent' : 'neutral'}>{t('m22.r360.formVersion', { v: f.num(d.form_version) })}</StatusPill></span>
      </div>
      {d.form_version === 1 && d.cycles.length > 0 && <p className="text-[12px] text-ink-3" data-testid="m22-360-v1-note">{t('m22.r360.v1Note')}</p>}
      <Grid cols={3}>
        <StatTile label={t('m22.r360.invited')} value={f.num(d.invited)} />
        <StatTile label={t('m22.r360.responded')} value={f.num(d.responded)} tone={d.enough ? 'ok' : 'sim'} sub={t('m22.r360.threshold', { n: f.num(d.min_raters) })} />
        <StatTile label={t('m22.r360.self')} value={d.self_submitted ? t('m22.r360.selfDone') : t('m22.r360.selfTodo')} />
      </Grid>
      {!d.enough ? (
        <div data-testid="m22-360-not-enough">
          <Callout tone="sim" title={t('m22.r360.notEnough')}>{t('m22.r360.notEnoughBody', { have: f.num(d.responded), need: f.num(d.min_raters) })}</Callout>
          <div className="mt-3"><ProgressBar value={(Math.min(d.responded, d.min_raters) / d.min_raters) * 100} tone="sim" label={t('m22.r360.responded')} /></div>
        </div>
      ) : (
        <Section title={t('m22.r360.resultsTitle')} description={t('m22.r360.resultsSub')}>
          <ul className="space-y-3" data-testid="m22-360-results">
            {d.behaviours!.map((b) => {
              const tr = traits.find((x) => x.id === BEHAVIOURS.find((y) => y.id === b.id)?.trait);
              const gap = b.self != null ? b.self - b.others : 0;
              return (
                <li key={b.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{t(`m22.behaviours.${b.id}.title`)}</div>
                      <div className="text-[12.5px] text-ink-2">{t(`m22.behaviours.${b.id}.statement`)}</div>
                      {tr && <div className="text-[11.5px] text-ink-3">{t('m22.leadership.trait', { trait: pick(tr, 'name') })}</div>}
                    </div>
                    {Math.abs(gap) >= 0.75 && <span className={`chip ${gap > 0 ? 'border-sim-line bg-sim-bg text-sim' : 'border-ok-line bg-ok-bg text-ok'}`}>{t(gap > 0 ? 'm22.r360.blindSpot' : 'm22.r360.hiddenStrength')}</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-[80px_1fr_40px] items-center gap-x-3 gap-y-1.5 text-[12.5px]">
                    <span className="text-ink-2">{t('m22.r360.others')}</span><ProgressBar value={(b.others / 5) * 100} label={t('m22.r360.others')} /><span className="num">{f.num(b.others)}</span>
                    {b.self != null && <><span className="text-ink-2">{t('m22.r360.selfShort')}</span><ProgressBar value={(b.self / 5) * 100} tone="info" label={t('m22.r360.selfShort')} /><span className="num">{f.num(b.self)}</span></>}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-3">{t('m22.r360.range', { low: f.num(b.low), high: f.num(b.high) })}</div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {d.invitees.length > 0 && (
        <Section title={t('m22.r360.invitees')}>
          <ul className="flex flex-wrap gap-1.5">{d.invitees.map((x, i) => <li key={i} className="chip border-line bg-panel text-ink-2">{pick({ name_en: x.name, name_ar: x.name_ar }, 'name')} · {t(`m22.raterKind.${x.kind}`)}</li>)}</ul>
          <p className="mt-2 text-[12px] text-ink-3">{t('m22.r360.inviteesNote')}</p>
        </Section>
      )}
    </div>
  );
}

function Give({ rows, me }: { rows: { id: string; cycle: string; subject_id: string; subject_name: string; subject_name_ar: string; rater_kind: string; status: string; invited_at: string; form_version?: number | null }[]; me: string | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [open, setOpen] = useState<string | null>(null);
  const list = [...rows].sort((a, b) => (a.status === b.status ? (a.invited_at < b.invited_at ? 1 : -1) : a.status === 'invited' ? -1 : 1));
  if (!list.length) return <div className="pt-4"><EmptyState icon="users" title={t('m22.r360.noInvites')} /></div>;
  return (
    <ul className="space-y-3 pt-4" data-testid="m22-360-inbox">
      {list.map((r) => (
        <li key={r.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{r.subject_id === me ? t('m22.r360.selfRating') : pick({ name_en: r.subject_name, name_ar: r.subject_name_ar }, 'name')}</div>
              <div className="text-[12.5px] text-ink-2">{t('m22.r360.asKind', { kind: t(`m22.raterKind.${r.rater_kind}`), cycle: r.cycle, date: f.date(r.invited_at) })} · {t('m22.r360.formVersion', { v: f.num(r.form_version ?? 1) })}</div>
            </div>
            <div className="flex items-center gap-2">
              <M22Pill kind="invite" status={r.status} />
              {r.status === 'invited' && <button className="btn-primary btn-sm" onClick={() => setOpen(open === r.id ? null : r.id)} data-testid="m22-360-rate">{t('m22.r360.rate')}</button>}
            </div>
          </div>
          {open === r.id && <ScoreSheet requestId={r.id} version={r.form_version ?? 1} onDone={() => setOpen(null)} />}
        </li>
      ))}
    </ul>
  );
}

function ScoreSheet({ requestId, version, onDone }: { requestId: string; version: number; onDone: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const beh = useBehaviours();
  const anchor = useAnchor();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);
  const ids = formBehaviours(version);
  const complete = ids.every((b) => scores[b] >= 1);
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3" data-testid="m22-360-sheet" data-form-version={version}>
      <p className="text-[12px] text-ink-3">{t('m22.r360.sheetNote', { n: ids.length })}</p>
      {ids.map((b) => (
        <fieldset key={b}>
          <legend className="text-[13px] font-semibold">{t(`m22.behaviours.${b}.title`)}</legend>
          <p className="text-[12px] text-ink-2">{t(`m22.behaviours.${b}.statement`)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <label key={v} className={`cursor-pointer rounded border px-2.5 py-1 text-[12.5px] ${scores[b] === v ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-panel'}`}>
                <input type="radio" className="sr-only" name={`${requestId}-${b}`} checked={scores[b] === v} onChange={() => setScores((x) => ({ ...x, [b]: v }))} />
                {v} · {t(`m22.r360.scale.${v}`)}
              </label>
            ))}
          </div>
          {scores[b] >= 1 && <p className="mt-1 text-[12px] text-ink-2" data-testid="m22-360-anchor">{t('m22.r360.anchorAt', { v: scores[b] })} {anchor(beh.data?.find((x) => x.id === b), scores[b])}</p>}
        </fieldset>
      ))}
      <button className="btn-primary" disabled={!complete} onClick={() => setConfirm(true)} data-testid="m22-360-submit"><Icon name="check" size={14} />{t('m22.r360.submit')}</button>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m22.r360.submitTitle')} consequence={t('m22.r360.submitBody')} confirmLabel={t('m22.r360.submit')}
        onConfirm={async () => { const r = await run(() => repo.rpc.submit360(requestId, scores)); if (r.ok) onDone(); }} />
    </div>
  );
}

function Request({ d, me }: { d: My360; me: string | null }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const name = usePersonName();
  const dir = useQuery(['community_members'], () => repo.list('community_members', { filter: { active: true } }).catch(() => []), [me]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [confirm, setConfirm] = useState(false);
  const people = useMemo(() => {
    const m = new Map<string, { id: string; name: string; name_ar: string }>();
    for (const x of dir.data ?? []) if (x.person_id !== me && !m.has(x.person_id)) m.set(x.person_id, { id: x.person_id, name: x.person_name, name_ar: x.person_name_ar });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [dir.data, me]);
  const ids = Object.keys(picked);
  const already = d.cycle && d.cycle === d.cycles[0] ? d.invited : 0;
  const shown = people.filter((p) => !filter || `${p.name} ${p.name_ar}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 40);
  const total = already + ids.length;
  return (
    <div className="space-y-4 pt-4">
      <p className="text-[13.5px] text-ink-2">{t('m22.r360.requestBody', { min: MIN_360_RATERS, max: MAX_360_INVITES })}</p>
      <p className="text-[12.5px] text-ink-3">{t('m22.r360.requestForm', { v: CURRENT_FORM_VERSION })}</p>
      {already > 0 && <Callout>{t('m22.r360.alreadyInvited', { n: already })}</Callout>}
      <input className="input" placeholder={t('m22.r360.searchColleagues')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('m22.r360.searchColleagues')} />
      <Async state={dir}>
        {() => (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="m22-360-directory">
            {shown.map((p) => (
              <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-card border p-2 ${picked[p.id] ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`}>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={!!picked[p.id]} onChange={(e) => setPicked((x) => { const n = { ...x }; if (e.target.checked) n[p.id] = 'peer'; else delete n[p.id]; return n; })} />
                  {name(p)}
                </label>
                {picked[p.id] && (
                  <select className="input w-auto py-1 text-[12.5px]" value={picked[p.id]} onChange={(e) => setPicked((x) => ({ ...x, [p.id]: e.target.value }))} aria-label={t('m22.r360.kind')}>
                    {RATER_KINDS.map((k) => <option key={k} value={k}>{t(`m22.raterKind.${k}`)}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
      </Async>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-[13px] ${total >= MIN_360_RATERS && total <= MAX_360_INVITES ? 'text-ok' : 'text-ink-2'}`}>{t('m22.r360.selected', { n: total, min: MIN_360_RATERS })}</span>
        <button className="btn-primary" disabled={!ids.length || total < MIN_360_RATERS || total > MAX_360_INVITES} onClick={() => setConfirm(true)} data-testid="m22-360-request">{t('m22.r360.send')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m22.r360.sendTitle')} consequence={t('m22.r360.sendBody', { n: ids.length })} confirmLabel={t('m22.r360.send')}
        onConfirm={async () => { const r = await run(() => repo.rpc.request360(ids.map((id) => ({ person_id: id, kind: picked[id] as 'peer' })))); if (r.ok) setPicked({}); }} />
    </div>
  );
}

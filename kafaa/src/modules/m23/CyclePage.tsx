// /talent/review/:cycleId (M23 · F18): the review board. Line managers place their people on the 3×3 grid (performance from the
// synthetic HR field, potential from three behavioural anchors) next to an evidence panel: skills breadth and growth (F01),
// validated check-ins (F10), completed opportunities and rotations (F08/F15), learning agility and the aspiration if shared (F12).
// Outlier flags mark placements the evidence does not support. Locked cycles feed the HiPo pool → ESTADAD nominations (F16).
// Confidential: rpc.talentBoard returns only people in the caller's scope and never the caller.
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, EmptyState, Callout, Grid, StatTile, Tabs, Drawer, Modal, ConfirmDialog, DataTable, TextArea, Icon, WhyThis, StatusPill, type Column } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { ANCHORS, MAX_ACTIONS, NOTE_MIN, boxOf, isHipo, median3, type DevAction, type EvidenceSnapshot } from './domain';
import { ActionKindPill, BoxName, ConfidentialNote, useAspirations, CyclePill, CycleSteps, EvidencePanel, FlagPills, NineBox, personName, unwrap, useCatalogue, useLabels, type Labels } from './ui';
import type { BoardMember, TalentBoard } from './backend/rpc';

export default function CyclePage() {
  const t = useT();
  const repo = useRepo();
  const { cycleId = '' } = useParams();
  const q = useQuery(['review_placements', 'review_cycles'], () => unwrap<TalentBoard>(repo.rpc.talentBoard(cycleId)), [cycleId]);
  const cat = useCatalogue();
  const lab = useLabels(cat.data);
  return (
    <Page title={t('m23.routes.talent-review-cycle.title')} eyebrow={<L to="/talent/review">{t('m23.common.back')}</L>} wide>
      <Async state={q}>{(b) => <Board b={b} lab={lab} />}</Async>
    </Page>
  );
}

function Board({ b, lab }: { b: TalentBoard; lab: Labels }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const lang = useLang();
  const [sel, setSel] = useState<string | null>(null);
  const [place, setPlace] = useState<BoardMember | null>(null);
  const asp = useAspirations(b.members.map((m) => m.person_id));
  const placed = b.members.filter((m) => m.placement);
  const flagged = b.members.filter((m) => m.flags.length);
  const selected = b.members.find((m) => m.person_id === sel) ?? null;
  const c = b.cycle;
  const cols: Column<BoardMember>[] = [
    { key: 'name', header: t('m23.board.colPerson'), value: (m) => personName(m, lang), sortable: true, render: (m) => <button type="button" className="text-start font-semibold text-accent hover:underline" onClick={() => setSel(m.person_id)} data-testid="m23-person">{personName(m, lang)}</button> },
    { key: 'role', header: t('m23.board.colRole'), value: (m) => lab.roleShort(m.role_id), sortable: true },
    { key: 'index', header: t('m23.board.colIndex'), value: (m) => m.index, sortable: true, align: 'end', render: (m) => <span className="num">{f.num(m.index)}</span> },
    { key: 'box', header: t('m23.board.colBox'), value: (m) => m.placement?.box ?? 0, sortable: true, render: (m) => (m.placement ? <span>{f.num(m.placement.box)} · <BoxName box={m.placement.box} /></span> : <span className="text-ink-3">{t('m23.board.notPlaced')}</span>) },
    { key: 'flags', header: t('m23.board.colFlags'), value: (m) => m.flags.join(','), render: (m) => <FlagPills flags={m.flags} /> },
    { key: 'cal', header: t('m23.board.colCalibrated'), value: (m) => (m.placement?.calibrated ? 1 : 0), render: (m) => (m.placement?.calibrated ? <StatusPill tone="ok">{t('m23.board.calibrated')}</StatusPill> : m.placement ? <StatusPill tone="info">{t('m23.board.placed')}</StatusPill> : null) },
    { key: 'act', header: '', csv: false, render: (m) => (m.can_place ? <button className="btn-outline btn-sm" onClick={() => setPlace(m)} data-testid="m23-place-open">{m.placement ? t('m23.board.update') : t('m23.board.place')}</button> : null) },
  ];
  const tabs = [
    { id: 'grid', label: t('m23.board.tabGrid'), content: (
      <div className="grid grid-cols-1 gap-4 pt-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={t('m23.board.gridTitle')} actions={<span className="text-[12px] text-ink-3">{t('m23.board.gridSub', { n: f.num(placed.length), of: f.num(b.members.length) })}</span>}>
          <NineBox members={b.members} onPick={setSel} selected={sel} lang={lang} />
        </Card>
        <Card title={t('m23.board.unplacedTitle')}>
          {b.members.filter((m) => !m.placement).length === 0 ? <EmptyState icon="check" title={t('m23.board.allPlaced')} /> : (
            <ul className="space-y-2" data-testid="m23-unplaced">
              {b.members.filter((m) => !m.placement).map((m) => (
                <li key={m.person_id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line p-2">
                  <button type="button" className="min-w-0 text-start" onClick={() => setSel(m.person_id)}>
                    <div className="truncate font-semibold">{personName(m, lang)}</div>
                    <div className="text-[12px] text-ink-3">{lab.roleShort(m.role_id)} · {t('m23.board.indexShort', { n: f.num(m.index) })}</div>
                  </button>
                  {m.can_place && <button className="btn-primary btn-sm" onClick={() => setPlace(m)} data-testid="m23-place-open">{t('m23.board.place')}</button>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    ) },
    { id: 'people', label: t('m23.board.tabPeople'), content: (
      <div className="pt-4" data-testid="m23-roster">
        <DataTable rows={b.members} columns={cols} rowKey={(m) => m.person_id} csvName={`talent-review-${c.code}.csv`} initialSort={{ key: 'name', dir: 'asc' }} caption={t('m23.board.tabPeople')} />
      </div>
    ) },
    ...(c.status === 'locked' ? [{ id: 'hipo', label: t('m23.board.tabHipo'), content: <div className="pt-4"><HipoList members={placed.filter((m) => m.placement!.hipo)} lab={lab} /></div> }] : []),
  ];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-[19px] font-semibold">{pick(c, 'title')}</h2>
          <div className="num text-[12.5px] text-ink-3">{c.code} · {c.period} · {c.family_ids.map((x) => lab.family(x)).join(' · ')}</div>
          <CycleSteps status={c.status} />
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <CyclePill status={c.status} />
          <L to={`/talent/review/${c.id}/calibration`} className="btn-outline btn-sm" data-testid="m23-to-calibration"><Icon name="filter" size={14} />{t('m23.routes.talent-review-calibration.title')}</L>
        </span>
      </div>
      <ConfidentialNote />
      {c.status === 'open' && <Callout title={t('m23.board.openTitle')}>{b.can.place ? t('m23.board.openBody') : t('m23.board.openBodyView')}</Callout>}
      {c.status === 'calibration' && <Callout tone="sim" title={t('m23.board.calTitle')}>{c.calibrated_at ? t('m23.board.calDone', { date: f.date(c.calibrated_at), name: c.calibrated_name ?? '' }) : t('m23.board.calBody')}</Callout>}
      {c.status === 'locked' && <Callout tone="ok" title={t('m23.board.lockedTitle', { date: f.date(c.locked_at) })}>{c.lock_note || t('m23.board.lockedBody')}</Callout>}
      <Grid cols={4}>
        <StatTile label={t('m23.board.inView')} value={f.num(b.members.length)} sub={b.view === 'all' ? t('m23.board.viewAll', { n: f.num(b.members_total) }) : t('m23.board.viewScope', { n: f.num(b.members_total) })} />
        <StatTile label={t('m23.board.placedTile')} value={f.num(placed.length)} tone={placed.length === b.members.length ? 'ok' : 'info'} />
        <StatTile label={t('m23.board.flagged')} value={f.num(flagged.length)} tone={flagged.length ? 'bad' : 'ok'} sub={b.cuts ? t('m23.board.cuts', { low: f.num(b.cuts.low), high: f.num(b.cuts.high) }) : t('m23.board.noCuts')} />
        <StatTile label={t('m23.board.hipo')} value={f.num(placed.filter((m) => m.placement!.hipo).length)} tone="ok" sub={t('m23.board.hipoSub')} />
      </Grid>
      <Tabs tabs={tabs} />
      <Drawer open={!!selected} onClose={() => setSel(null)} title={selected ? personName(selected, lang) : ''}
        footer={selected?.can_place ? <button className="btn-primary" onClick={() => { setPlace(selected); setSel(null); }} data-testid="m23-place-open">{selected.placement ? t('m23.board.update') : t('m23.board.place')}</button> : undefined}>
        {selected && <PersonPanel m={selected} lab={lab} asp={asp?.get(selected.person_id) ?? null} />}
      </Drawer>
      {place && <PlaceModal m={place} cycleId={c.id} onClose={() => setPlace(null)} />}
    </>
  );
}

function PersonPanel({ m, lab, asp }: { m: BoardMember; lab: Labels; asp: import('../m18/conversations').AspirationSignal | null }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const p = m.placement;
  return (
    <div className="space-y-4" data-testid="m23-person-panel">
      <div className="text-[13px] text-ink-2">{lab.role(m.role_id)}{m.crew ? ` · ${t('m23.board.crew', { crew: m.crew })}` : ''}</div>
      {p ? (
        <Card title={<span><span className="num">{f.num(p.box)}</span> · <BoxName box={p.box} /></span>} actions={<FlagPills flags={m.flags} />}>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <dt className="text-ink-3">{t('m23.place.perf')}</dt><dd>{t(`m23.perf.${p.perf}`)}</dd>
            <dt className="text-ink-3">{t('m23.place.potential')}</dt><dd>{t(`m23.pot.${p.potential}`)}</dd>
            {ANCHORS.map((a) => <Fragment key={a}><dt className="text-ink-3">{t(`m23.anchor.${a}`)}</dt><dd className="num">{f.num(p.anchors[a] ?? 0)}/3</dd></Fragment>)}
            <dt className="text-ink-3">{t('m23.place.by')}</dt><dd>{lang === 'ar' ? p.placed_by_name_ar : p.placed_by_name} · {f.date(p.placed_at)}</dd>
            <dt className="text-ink-3">{t('m23.place.snapshot')}</dt><dd className="num">{f.num(p.evidence_index)}</dd>
          </dl>
          {p.note && <p className="mt-2 rounded-btn bg-sunken p-2 text-[13px]">“{p.note}”</p>}
          {m.flags.length > 0 && <p className="mt-2 text-[12.5px] text-bad">{t(`m23.flagHelp.${m.flags[0]}`)}</p>}
          {p.actions.length > 0 && (
            <div className="mt-3">
              <div className="caps mb-1">{t('m23.place.actions')}</div>
              <ul className="space-y-1 text-[13px]">{p.actions.map((a, i) => <li key={i} className="flex flex-wrap items-center gap-1.5"><ActionKindPill kind={a.kind} />{lang === 'ar' ? a.title_ar : a.title_en}</li>)}</ul>
            </div>
          )}
        </Card>
      ) : <EmptyState icon="user" title={t('m23.board.notPlaced')}>{t('m23.board.notPlacedBody')}</EmptyState>}
      <Section title={t('m23.ev.title')} description={t('m23.ev.desc')}>
        <EvidencePanel ev={m.evidence} aspiration={asp} perf={m.perf_rating} />
      </Section>
    </div>
  );
}

/** Deterministic development-action suggestions from the box and the evidence, each with its reason. */
function suggestions(ev: EvidenceSnapshot, perf: number, pot: number): (DevAction & { why: string })[] {
  const out: (DevAction & { why: string })[] = [];
  if (isHipo(perf, pot)) {
    out.push({ kind: 'training', title_en: 'ESTADAD leadership programme (nomination via the Leadership Academy)', title_ar: 'برنامج استعداد القيادي (الترشيح عبر أكاديمية القيادة)', ref_table: 'courses', ref_id: 'c-estadad', why: 'hipo' });
    out.push({ kind: 'rotation', title_en: 'High-potential leadership rotation (12 months)', title_ar: 'تدوير قيادي لأصحاب الإمكانات العالية (12 شهراً)', ref_table: 'rotation_templates', ref_id: 'rt-hipo-leadership', why: 'hipo' });
    out.push({ kind: 'mentoring', title_en: 'Leadership mentoring with a senior leader', title_ar: 'إرشاد قيادي مع قائد أول', ref_table: 'leadership_programmes', ref_id: 'prog-mentoring', why: 'hipo' });
  }
  if (ev.validated < 2) out.push({ kind: 'coaching', title_en: 'Skill check-in with the line manager to validate key skills', title_ar: 'مراجعة مهارات مع المدير المباشر للتحقق من المهارات الرئيسية', ref_table: null, ref_id: null, why: 'validated' });
  if (ev.opportunities === 0) out.push({ kind: 'stretch', title_en: 'Take a gig or project from the opportunity marketplace', title_ar: 'المشاركة في مهمة أو مشروع من سوق الفرص', ref_table: null, ref_id: null, why: 'opportunities' });
  if (ev.growth < 5) out.push({ kind: 'training', title_en: 'Learning Coach plan to close the top competency gap', title_ar: 'خطة مع مدرب التعلّم لسد أكبر فجوة في الكفاءات', ref_table: null, ref_id: null, why: 'growth' });
  if (pot === 3 && perf === 1) out.push({ kind: 'coaching', title_en: 'Monthly coaching on delivery and priorities', title_ar: 'تدريب شهري على الإنجاز وترتيب الأولويات', ref_table: null, ref_id: null, why: 'delivery' });
  if (boxOf(perf, pot) <= 2) out.push({ kind: 'coaching', title_en: 'Agreed support plan with fortnightly check-ins', title_ar: 'خطة دعم متفق عليها مع متابعة كل أسبوعين', ref_table: null, ref_id: null, why: 'support' });
  if (ev.depth >= 6 && pot <= 2) out.push({ kind: 'stretch', title_en: 'Present a knowledge-sharing session to the community of practice', title_ar: 'تقديم جلسة لتبادل المعرفة في مجتمع الممارسة', ref_table: null, ref_id: null, why: 'depth' });
  return out;
}

function Choice({ legend, value, onChange, options, testId }: { legend: ReactNode; value: number; onChange: (v: number) => void; options: { v: number; label: string }[]; testId: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-[13px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1.5" data-testid={testId}>
        {options.map((o) => (
          <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)} className={`btn-sm ${value === o.v ? 'btn-primary' : 'btn-outline'}`}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  );
}

function PlaceModal({ m, cycleId, onClose }: { m: BoardMember; cycleId: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const p = m.placement;
  const [perf, setPerf] = useState<number>(p?.perf ?? m.suggested_perf ?? 2);
  const [anch, setAnch] = useState<Record<string, number>>(Object.fromEntries(ANCHORS.map((a) => [a, p?.anchors[a] ?? 2])));
  const [note, setNote] = useState(p?.note ?? '');
  const [custom, setCustom] = useState('');
  const pot = median3(anch.agility, anch.influence, anch.drive);
  const sugg = useMemo(() => suggestions(m.evidence, perf, pot), [m.evidence, perf, pot]);
  const [picked, setPicked] = useState<DevAction[]>(p?.actions ?? []);
  const [confirm, setConfirm] = useState(false);
  const deviates = m.suggested_perf != null && perf !== m.suggested_perf;
  const noteMissing = deviates && note.trim().length < NOTE_MIN;
  const has = (a: DevAction) => picked.some((x) => x.title_en === a.title_en);
  const toggle = (a: DevAction) => setPicked((cur) => (has(a) ? cur.filter((x) => x.title_en !== a.title_en) : cur.length < MAX_ACTIONS ? [...cur, { kind: a.kind, title_en: a.title_en, title_ar: a.title_ar, ref_table: a.ref_table ?? null, ref_id: a.ref_id ?? null }] : cur));
  const box = boxOf(perf, pot);
  return (
    <Modal open onClose={onClose} size="lg" title={t('m23.place.title', { name: personName(m, lang) })}
      footer={<>
        <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={noteMissing} onClick={() => setConfirm(true)} data-testid="m23-place-save">{t('m23.place.save')}</button>
      </>}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Choice legend={<span className="flex flex-wrap items-center gap-2">{t('m23.place.perf')}{m.perf_rating && <span className="text-[12px] font-normal text-ink-3">{t('m23.place.perfFromHr', { rating: f.num(m.perf_rating.rating), period: m.perf_rating.period, level: t(`m23.perf.${m.suggested_perf}`) })}</span>}</span>}
            value={perf} onChange={setPerf} options={[1, 2, 3].map((v) => ({ v, label: t(`m23.perf.${v}`) }))} testId="m23-perf" />
          {ANCHORS.map((a) => (
            <div key={a}>
              <Choice legend={t(`m23.anchor.${a}`)} value={anch[a]} onChange={(v) => setAnch((x) => ({ ...x, [a]: v }))} options={[1, 2, 3].map((v) => ({ v, label: t(`m23.anchorLevel.${v}`) }))} testId={`m23-anchor-${a}`} />
              <p className="mt-1 text-[12px] text-ink-3">{t(`m23.anchorHint.${a}.${anch[a]}`)}</p>
            </div>
          ))}
          <TextArea label={t('m23.place.note')} name="note" value={note} onChange={setNote} rows={3} hint={deviates ? t('m23.place.noteRequired') : t('m23.place.noteHint')} error={noteMissing && note ? t('m23.place.noteRequired') : null} />
        </div>
        <div className="space-y-3">
          <Card title={t('m23.place.preview')}>
            <div className="space-y-1 text-[13px]" data-testid="m23-place-preview">
              <div className="text-[22px] font-semibold"><span className="num">{f.num(box)}</span> · <BoxName box={box} /></div>
              <div className="text-ink-2">{t('m23.place.potentialIs', { level: t(`m23.pot.${pot}`) })}</div>
              {isHipo(perf, pot) && <StatusPill tone="ok">{t('m23.place.hipo')}</StatusPill>}
            </div>
          </Card>
          <EvidencePanel ev={m.evidence} compact />
        </div>
      </div>
      <Section title={t('m23.place.actions')} description={t('m23.place.actionsDesc', { n: f.num(MAX_ACTIONS) })}>
        <ul className="space-y-1.5" data-testid="m23-suggestions">
          {sugg.map((a) => (
            <li key={a.title_en} className="flex flex-wrap items-center gap-2 text-[13px]">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input type="checkbox" checked={has(a)} onChange={() => toggle(a)} className="accent-[rgb(var(--accent))]" />
                <ActionKindPill kind={a.kind} /><span className="min-w-0">{lang === 'ar' ? a.title_ar : a.title_en}</span>
              </label>
              <WhyThis reasons={[{ code: a.why, key: `m23.sugg.${a.why}` }]} testId="m23-why-sugg" />
            </li>
          ))}
          {picked.filter((x) => !sugg.some((s) => s.title_en === x.title_en)).map((a) => (
            <li key={a.title_en} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked onChange={() => toggle(a)} aria-label={a.title_en} /><ActionKindPill kind={a.kind} />{lang === 'ar' ? a.title_ar : a.title_en}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input className="input max-w-md flex-1" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t('m23.place.customPh')} aria-label={t('m23.place.custom')} maxLength={200} />
          <button className="btn-outline btn-sm" disabled={!custom.trim() || picked.length >= MAX_ACTIONS} onClick={() => { toggle({ kind: 'stretch', title_en: custom.trim(), title_ar: custom.trim() }); setCustom(''); }}>{t('m23.place.add')}</button>
        </div>
      </Section>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m23.place.confirmTitle')} consequence={t('m23.place.confirmBody', { name: personName(m, lang), box: f.num(box) })}
        confirmLabel={t('m23.place.save')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.placeTalent({ cycle_id: cycleId, person_id: m.person_id, perf, anchors: anch, note: note.trim() || null, actions: picked }));
          if (r.ok) onClose();
        }} />
    </Modal>
  );
}

export function HipoList({ members, lab }: { members: BoardMember[]; lab: Labels }) {
  const t = useT();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const noms = useQuery('leadership_nominations', () => repo.list('leadership_nominations', { filter: { programme_id: 'prog-estadad' } }).catch(() => []), []);
  const [nom, setNom] = useState<BoardMember | null>(null);
  if (!members.length) return <EmptyState icon="sparkle" title={t('m23.pool.none')} />;
  return (
    <>
      <p className="mb-3 text-[13px] text-ink-2">{t('m23.pool.intro')}</p>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="m23-hipo">
        {members.map((m) => {
          const n = (noms.data ?? []).find((x) => x.person_id === m.person_id && x.status !== 'declined');
          return (
            <li key={m.person_id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{personName(m, lang)}</div>
                <div className="text-[12px] text-ink-3">{lab.roleShort(m.role_id)} · <BoxName box={m.placement!.box} /></div>
              </div>
              {n ? <StatusPill tone={n.status === 'approved' ? 'ok' : 'info'}>{t(`m23.pool.nom.${n.status}`)}</StatusPill>
                : s.hasRole('manager') ? <button className="btn-primary btn-sm" onClick={() => setNom(m)} data-testid="m23-nominate">{t('m23.pool.nominate')}</button>
                  : <span className="text-[12px] text-ink-3">{t('m23.pool.notNominated')}</span>}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!nom} onClose={() => setNom(null)} requireReason reasonLabel={t('m23.pool.reason')} title={t('m23.pool.nominateTitle')}
        consequence={t('m23.pool.nominateBody', { name: nom ? personName(nom, lang) : '' })} confirmLabel={t('m23.pool.nominate')}
        onConfirm={async (reason) => { if (nom) await run(() => repo.rpc.nominateLeader(nom.person_id, 'prog-estadad', reason.length >= 10 ? reason : `${reason} (talent review HiPo pool)`)); }} />
    </>
  );
}

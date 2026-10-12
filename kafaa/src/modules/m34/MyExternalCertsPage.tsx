// FS79 /my/recognition/certificates · My external certificates (recognition Own). I add a certificate (metadata, the issuer's https
// verification link and the crosswalk entries it covers); it reads as "claimed" until a verifier (never me) verifies it. The trust tier
// (ENEC-assessed, accredited third party, vendor self-serve) shows on every certificate, and only reviewed FS08 crosswalk rows map to skills.
// rpc.submitExternalCert (submit, withdraw). Kafa'a records the verification; it is not an awarding or regulatory body.
import { useMemo, useState, type ReactNode } from 'react';
import { Async, BenchmarkChips, Callout, Card, ConfirmDialog, Drawer, EmptyState, KeyValue, Page, Section, SelectField, StatTile, TextArea, TextField, WhyThis } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ISSUER_KINDS, MAX_ALIGNMENTS, certMapping, checkSubmit, issuerTier, tierReasons, trustTier, type AlignmentLite, type CertLite, type MapRow, type SkillLite } from './extcerts';
import { NotAuthority } from './ui';
import { CertStatus, MappingList, TierLegend, TrustTierBadge, isoToday, useFs91Act, type Row } from './fs91ui';
import { useSession } from '../../auth/session';

export default function MyExternalCertsPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId ?? '';
  const q = useQuery(['external_certs', 'skill_alignments', 'skill_evidence'], async () => {
    const [certs, als, skills, res] = await Promise.all([
      repo.list('external_certs', { filter: { person_id: me }, order: [['created_at', 'desc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('skill_alignments', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('skills', {}).catch(() => []) as Promise<Row[]>,
      repo.list('external_resources', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
    ]);
    return { certs: certs.filter((c) => c.person_id === me), als, skills, res };
  }, [me]);
  return (
    <Page title={t('m34.routes.my-external-certs.title')} eyebrow={t('m34.xc.eyebrow')} intro={t('m34.xc.intro')} wide
      actions={<L to="/my/recognition" className="btn-outline">{t('m34.xc.toRecognition')}</L>}>
      <div data-testid="m34-xc-bench"><BenchmarkChips feature="FS79" /></div>
      <Async state={q}>{(d) => <Body d={d} />}</Async>
      <NotAuthority />
    </Page>
  );
}

type D = { certs: Row[]; als: Row[]; skills: Row[]; res: Row[] };
function Body({ d }: { d: D }) {
  const t = useT();
  const f = useFormat();
  const [add, setAdd] = useState(false);
  const [wd, setWd] = useState<Row | null>(null);
  const run = useFs91Act();
  const repo = useRepo();
  const alMap = useMemo(() => new Map(d.als.map((a) => [a.id, a as AlignmentLite])), [d.als]);
  const skMap = useMemo(() => new Map(d.skills.map((k) => [k.id, k])), [d.skills]);
  const verified = d.certs.filter((c) => c.status === 'verified');
  const skillsMapped = new Set(verified.flatMap((c) => ((c.mapped ?? []) as MapRow[]).filter((r) => r.state === 'maps').map((r) => r.skill_id)));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="m34-xc-tiles">
        <StatTile label={t('m34.xc.tAll')} value={f.num(d.certs.length)} sub={t('m34.xc.tAllSub', { n: f.num(d.certs.filter((c) => c.status === 'submitted').length) })} />
        <StatTile label={t('m34.xc.tVerified')} value={f.num(verified.length)} sub={t('m34.xc.tVerifiedSub')} tone="ok" />
        <StatTile label={t('m34.xc.tSkills')} value={f.num(skillsMapped.size)} sub={t('m34.xc.tSkillsSub')} tone="info" />
      </div>
      <Section title={t('m34.xc.tiersTitle')} description={t('m34.xc.tiersDesc')}><TierLegend /></Section>
      <Section title={t('m34.xc.mineTitle')} actions={<button type="button" className="btn-primary" onClick={() => setAdd(true)} data-testid="m34-xc-add">{t('m34.xc.add')}</button>}>
        {d.certs.length === 0 ? <EmptyState title={t('m34.xc.empty')}>{t('m34.xc.emptyBody')}</EmptyState> : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="m34-xc-list">
            {d.certs.map((c) => <CertCard key={c.id} c={c} alMap={alMap} skMap={skMap} onWithdraw={() => setWd(c)} />)}
          </div>
        )}
      </Section>
      {add && <AddDrawer d={d} alMap={alMap} skMap={skMap} onClose={() => setAdd(false)} />}
      <ConfirmDialog open={!!wd} onClose={() => setWd(null)} title={t('m34.xc.withdrawTitle')} consequence={t('m34.xc.withdrawBody')}
        onConfirm={async () => { if (wd) await run(() => repo.rpc.submitExternalCert({ action: 'withdraw', id: wd.id }), t('m34.xc.withdrawn')); setWd(null); }} />
    </div>
  );
}

export function CertCard({ c, alMap, skMap, onWithdraw, actions }: { c: Row; alMap: Map<string, AlignmentLite>; skMap: Map<string, Row>; onWithdraw?: () => void; actions?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  const tier = trustTier(c as CertLite);
  const rows: MapRow[] = c.status === 'verified' || c.status === 'revoked' ? (c.mapped ?? []) : certMapping(c, issuerTier(c as CertLite), alMap, skMap as Map<string, SkillLite>).rows;
  return (
    <div data-testid={`m34-xc-cert-${c.id}`}><Card title={c.title} eyebrow={c.issuer} actions={<TrustTierBadge tier={tier} />}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <CertStatus status={c.status} />
          <span className="text-ink-2">{t(`m34.xc.kind.${c.issuer_kind}`)}</span>
          {c.accreditation_ref && <span className="text-ink-3">· {t('m34.xc.accRef', { ref: c.accreditation_ref })}</span>}
          <WhyThis reasons={tierReasons(c as never)} testId={`m34-xc-why-${c.id}`} />
        </div>
        <KeyValue items={[
          [t('m34.xc.fCredRef'), <span key="r" className="font-mono text-[12px]" dir="ltr">{c.credential_ref}</span>],
          [t('m34.xc.issued'), f.date(String(c.issued_on).slice(0, 10))],
          ...(c.expires_on ? [[t('m34.xc.expires'), f.date(String(c.expires_on).slice(0, 10))] as [string, string]] : []),
          [t('m34.xc.link'), <a key="u" href={c.verification_url} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline" dir="ltr">{c.verification_url}</a>],
          ...(c.verified_on ? [[t('m34.xc.verifiedOn'), `${f.date(String(c.verified_on).slice(0, 10))} · ${t(`m34.xc.method.${c.method}`)}`] as [string, string]] : []),
        ]} />
        {c.decision_note && <p className="text-[13px] text-ink-2">{t('m34.xc.note', { note: c.decision_note })}</p>}
        <div>
          <p className="caps mb-1">{t('m34.xc.crosswalk')}</p>
          <MappingList rows={rows} skills={skMap} verified={c.status === 'verified'} />
        </div>
        {c.status === 'revoked' && <p className="text-[12px] text-bad">{t('m34.xc.revokedNote')}</p>}
        <div className="flex flex-wrap gap-2">
          {onWithdraw && c.status === 'submitted' && <button type="button" className="btn-ghost btn-sm" onClick={onWithdraw} data-testid={`m34-xc-withdraw-${c.id}`}>{t('m34.xc.withdraw')}</button>}
          {actions}
        </div>
      </div>
    </Card></div>
  );
}

function AddDrawer({ d, alMap, skMap, onClose }: { d: D; alMap: Map<string, AlignmentLite>; skMap: Map<string, Row>; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useFs91Act();
  const today = isoToday();
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [kind, setKind] = useState('');
  const [acc, setAcc] = useState('');
  const [ref, setRef] = useState('');
  const [issued, setIssued] = useState('');
  const [expires, setExpires] = useState('');
  const [url, setUrl] = useState('');
  const [resource, setResource] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const ids = Object.keys(picked).sort();
  const input = { title, issuer, issuer_kind: kind, accreditation_ref: acc || null, credential_ref: ref, issued_on: issued, expires_on: expires || null, verification_url: url, alignment_ids: ids, levels: picked, resource_id: resource || null, note: note || null };
  const dup = d.certs.some((c) => c.verification_url === url.trim() && (c.status === 'submitted' || c.status === 'verified'));
  const code = checkSubmit(input, { today, alignments: alMap, skills: skMap as Map<string, SkillLite>, duplicate: dup });
  const preview = (ISSUER_KINDS as readonly string[]).includes(kind) ? certMapping(input, issuerTier({ issuer_kind: kind, accreditation_ref: acc }), alMap, skMap as Map<string, SkillLite>) : null;
  const pool = useMemo(() => {
    const qx = search.trim().toLowerCase();
    return d.als.filter((a) => a.status !== 'retired' && skMap.get(a.skill_id)?.area !== 'security')
      .filter((a) => !qx || `${a.label_en} ${a.label_ar} ${pick(skMap.get(a.skill_id), 'name')} ${a.framework}`.toLowerCase().includes(qx)).slice(0, 40);
  }, [d.als, skMap, search, pick]);
  const fromRes = (id: string) => {
    setResource(id);
    const x = d.res.find((r) => r.id === id);
    if (x) { if (!title) setTitle(`${pick(x, 'title')}`); if (!issuer) setIssuer(pick(x, 'provider')); if (!kind) setKind('online_platform'); }
  };
  return (
    <Drawer open onClose={onClose} title={t('m34.xc.addTitle')}>
      <div className="space-y-3" data-testid="m34-xc-add-drawer">
        <p className="text-[13px] text-ink-2">{t('m34.xc.addBody')}</p>
        <SelectField name="resource" label={t('m34.xc.fResource')} value={resource} onChange={fromRes} placeholder={t('m34.xc.fResourceNone')} options={d.res.filter((x) => x.status === 'published').map((x) => ({ value: x.id, label: pick(x, 'title') }))} />
        <TextField name="title" label={t('m34.xc.fTitle')} value={title} onChange={setTitle} />
        <TextField name="issuer" label={t('m34.xc.fIssuer')} value={issuer} onChange={setIssuer} />
        <SelectField name="kind" label={t('m34.xc.fKind')} value={kind} onChange={setKind} options={ISSUER_KINDS.map((k) => ({ value: k, label: t(`m34.xc.kind.${k}`) }))} />
        {(kind === 'university' || kind === 'professional_body') && <TextField name="acc" label={t('m34.xc.fAcc')} value={acc} onChange={setAcc} hint={t('m34.xc.fAccHint')} />}
        <TextField name="ref" label={t('m34.xc.fCredRef')} value={ref} onChange={setRef} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField name="issued" type="date" label={t('m34.xc.issued')} value={issued} onChange={setIssued} />
          <TextField name="expires" type="date" label={t('m34.xc.fExpires')} value={expires} onChange={setExpires} />
        </div>
        <TextField name="url" type="url" label={t('m34.xc.fUrl')} value={url} onChange={setUrl} hint={t('m34.xc.fUrlHint')} />
        <div>
          <TextField name="search" label={t('m34.xc.fSearch', { n: f.num(MAX_ALIGNMENTS) })} value={search} onChange={setSearch} />
          <ul className="mt-2 max-h-60 space-y-1 overflow-auto rounded-card border border-line p-2" data-testid="m34-xc-pool">
            {pool.map((a) => {
              const on = a.id in picked;
              const rev = a.status === 'published' && !!a.reviewed_by && !!a.reviewed_on;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <label className="inline-flex min-w-0 flex-1 items-center gap-2">
                    <input type="checkbox" checked={on} onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[a.id] = 1; else delete n[a.id]; return n; })} data-testid={`m34-xc-pick-${a.id}`} />
                    <span className="min-w-0">{pick(a, 'label')} <span className="text-ink-3">· {t(`m34.xc.fw.${a.framework}`)} → {pick(skMap.get(a.skill_id), 'name')}</span></span>
                  </label>
                  <span className={`chip ${rev ? 'border-ok-line bg-ok-bg text-ok' : 'border-sim-line bg-sim-bg text-sim'}`}>{rev ? t('m34.xc.reviewed') : t('m34.xc.unreviewed')}</span>
                  {on && <select className="input w-auto py-0.5" value={picked[a.id]} aria-label={t('m34.xc.fLevel')} onChange={(e) => setPicked((p) => ({ ...p, [a.id]: Number(e.target.value) }))}>{[1, 2, 3].map((l) => <option key={l} value={l}>{t('m34.xc.levelN', { n: f.num(l) })}</option>)}</select>}
                </li>
              );
            })}
          </ul>
        </div>
        {preview && ids.length > 0 && <Card title={t('m34.xc.previewTitle')}><MappingList rows={preview.rows} skills={skMap} verified={false} /><p className="mt-2 text-[12px] text-ink-3">{t('m34.xc.previewNote')}</p></Card>}
        <TextArea name="note" label={t('m34.xc.fNote')} rows={2} value={note} onChange={setNote} />
        {code === 'ok' ? <Callout tone="ok" title={t('m34.xc.okTitle')}>{t('m34.xc.okBody')}</Callout> : <Callout tone="bad" title={t('m34.xc.failTitle')}><span data-testid="m34-xc-check">{t(`m34.xcmsg.${code}`)}</span></Callout>}
        <button type="button" className="btn-primary" disabled={code !== 'ok'} onClick={() => setConfirm(true)} data-testid="m34-xc-send">{t('m34.xc.send')}</button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m34.xc.confirmTitle')} consequence={t('m34.xc.confirmBody')}
        onConfirm={async () => { const r = await run(() => repo.rpc.submitExternalCert({ action: 'submit', ...input }), t('m34.xc.sent')); setConfirm(false); if (r.ok) onClose(); }} />
    </Drawer>
  );
}

// FS05 /careers/roles/:slug/profile: role profile editor for the training manager and admins. Edit the open draft (or start
// one from the published version) for a horizon, check it live with the same rule the RPC uses (checkVersion), save the
// draft, or publish it (supersedes the previous version; audited and written to the NEXUS evidence ledger). Security,
// safeguards and cyber roles stay at career-path level: no requirements can be added.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Grid, Async, EmptyState, Callout, StatusPill, Icon, SelectField, TextField, TextArea, ConfirmDialog, useFilters } from '../../ui';
import { useAction, useRepo } from '../../data';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useCrumbLabel } from '../../shell/crumbs';
import { useCareerData, type CareerData, type Role } from './shared';
import { BenchmarkChips, PlanningNotice, useProfileData, useReqLabel, type ProfileData, type ProfileRow } from './horizons';
import {
  DRIVERS, HORIZONS, IMPORTANCE, SECURITY_COMPETENCY_DOMAIN, SECURITY_SKILL_AREA, changeSize, checkVersion, publishedByHorizon, reqsOf,
  type Horizon, type ProfileReq, type ProfileSource,
} from './roleProfiles';

export default function CareersProfileEditPage() {
  const t = useT();
  const { slug = '' } = useParams();
  const c = useCareerData();
  const p = useProfileData();
  const role = c.data?.anyRoleById.get(slug);
  const pick = usePick();
  useCrumbLabel(role ? pick(role, 'title') : null);
  if (c.data && !role)
    return (
      <Page title={t('m01.routes.careers-profile-edit.title')}>
        <EmptyState title={t('m01.role.notFound')} action={<L to="/careers/horizons" className="btn-outline btn-sm">{t('m01.fs05.edit.back')}</L>} />
      </Page>
    );
  return (
    <Page title={role ? t('m01.fs05.edit.title', { role: pick(role, 'title') }) : t('m01.routes.careers-profile-edit.title')} intro={t('m01.fs05.edit.intro')}>
      <div className="mb-4"><BenchmarkChips /></div>
      <Async state={c}>{(cd) => <Async state={p}>{(pd) => (role ? <EditorShell role={role} c={cd} p={pd} /> : null)}</Async>}</Async>
    </Page>
  );
}

function EditorShell({ role, c, p }: { role: Role; c: CareerData; p: ProfileData }) {
  const t = useT();
  const f = useFormat();
  const [q, setQ] = useFilters({ h: '2030' }, true);
  const h = ((HORIZONS as readonly string[]).includes(q.h) ? q.h : '2030') as Horizon;
  const mine = p.versions.filter((v) => v.role_id === role.id && v.horizon === h).sort((a, b) => b.version - a.version);
  const draft = mine.find((v) => v.status === 'draft') ?? null;
  const published = publishedByHorizon(p.versions, role.id)[h] ?? null;
  const base = draft ?? published;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-card border border-line bg-panel p-0.5" role="tablist" aria-label={t('m01.fs05.panel.horizons')}>
          {HORIZONS.map((x) => (
            <button key={x} role="tab" aria-selected={x === h} className={`rounded-[6px] px-3 py-1.5 text-[13px] font-semibold ${x === h ? 'bg-accent text-white' : 'text-ink-2'}`} onClick={() => setQ({ h: x })} data-testid={`m01-edit-h-${x}`}>
              {t(`m01.fs05.h.${x}`)}
            </button>
          ))}
        </div>
        <L to={`/careers/roles/${role.id}?tab=horizons`} className="btn-ghost btn-sm">
          {t('m01.fs05.edit.viewPublic')}
        </L>
      </div>
      {h !== 'now' && <PlanningNotice />}
      {role.security_sensitive && (
        <Callout tone="info" title={t('m01.fs05.panel.pathOnlyTitle')}>
          {t('m01.fs05.edit.pathOnly')}
        </Callout>
      )}
      <Editor key={`${role.id}-${h}-${base?.id ?? 'new'}-${base?.updated_at ?? ''}`} role={role} h={h} base={base} draft={draft} c={c} p={p} />
      <Section title={t('m01.fs05.edit.history')}>
        {mine.length === 0 ? (
          <p className="text-[13.5px] text-ink-2">{t('m01.fs05.edit.noHistory')}</p>
        ) : (
          <ol className="space-y-1.5" data-testid="m01-version-history">
            {mine.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <StatusPill status={v.status} />
                <span className="num">{t('m01.fs05.panel.version', { n: f.num(v.version) })}</span>
                <span className="text-ink-3">
                  {v.published_at ? t('m01.fs05.panel.publishedOn', { date: f.date(v.published_at) }) : t('m01.fs05.edit.updatedOn', { date: f.date(v.updated_at) })}
                </span>
                <span className="text-ink-3">· {t('m01.fs05.overview.reqs', { n: f.num(reqsOf(v).length) })}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

type EditReq = ProfileReq & { _k: string };

function Editor({ role, h, base, draft, c, p }: { role: Role; h: Horizon; base: ProfileRow | null; draft: ProfileRow | null; c: CareerData; p: ProfileData }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const act = useAction();
  const label = useReqLabel(p);
  const sec = !!role.security_sensitive;
  const [reqs, setReqs] = useState<EditReq[]>(() => reqsOf(base).map((r) => ({ ...r, _k: `${r.kind}:${r.ref_id}` })));
  const [ratEn, setRatEn] = useState(base?.rationale_en ?? '');
  const [ratAr, setRatAr] = useState(base?.rationale_ar ?? '');
  const [sources, setSources] = useState<ProfileSource[]>(() => (Array.isArray(base?.sources) ? (base!.sources as ProfileSource[]) : []));
  const [addKind, setAddKind] = useState<'competency' | 'skill'>('skill');
  const [addRef, setAddRef] = useState('');
  const [srcLabel, setSrcLabel] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const clean = reqs.map(({ _k, ...r }) => r);
  const drivers = [...new Set(clean.map((r) => r.driver).filter(Boolean) as string[])].sort();
  const input = { role_id: role.id, horizon: h, requirements: clean, drivers, rationale_en: ratEn, rationale_ar: ratAr, sources };
  const ctx = { role: { id: role.id, lifecycle: role.lifecycle, security_sensitive: sec }, competencies: p.compDomain, skills: p.skillArea };
  const saveCode = checkVersion({ ...input, publish: false }, ctx);
  const pubCode = checkVersion({ ...input, publish: true }, ctx);
  const prevH = HORIZONS[HORIZONS.indexOf(h) - 1];
  const prev = prevH ? publishedByHorizon(p.versions, role.id)[prevH] : undefined;
  const size = changeSize(reqsOf(prev), clean);

  const options = useMemo(() => {
    const have = new Set(reqs.map((r) => r._k));
    if (addKind === 'competency')
      return [...p.comps.values()].filter((x) => x.domain !== SECURITY_COMPETENCY_DOMAIN && !have.has(`competency:${x.id}`)).map((x) => ({ value: x.id, label: `${x.code} · ${pick(x, 'name')}` }));
    return [...p.skills.values()].filter((x) => x.area !== SECURITY_SKILL_AREA && !have.has(`skill:${x.id}`)).sort((a, b) => a.sort - b.sort).map((x) => ({ value: x.id, label: pick(x, 'name') }));
  }, [addKind, p, reqs, pick]);

  const patch = (k: string, x: Partial<ProfileReq>) => setReqs((rs) => rs.map((r) => (r._k === k ? { ...r, ...x } : r)));
  const add = () => {
    if (!addRef) return;
    setReqs((rs) => [...rs, { kind: addKind, ref_id: addRef, level: 2, importance: 'important', why_en: '', why_ar: '', driver: null, _k: `${addKind}:${addRef}` }]);
    setAddRef('');
  };
  const save = async (publish: boolean) => {
    setBusy(true);
    const r = await act(() => repo.rpc.saveRoleProfileVersion({ ...input, publish }), { success: publish ? t('m01.fs05.edit.published') : t('m01.fs05.edit.saved') });
    setBusy(false);
    return r;
  };

  return (
    <>
      <Grid cols={2}>
        <Card title={t('m01.fs05.edit.status')}>
          <div className="flex flex-wrap items-center gap-2 text-[13px]" data-testid="m01-edit-base">
            {base ? <StatusPill status={base.status} /> : <StatusPill tone="neutral">{t('m01.fs05.edit.new')}</StatusPill>}
            {base && <span className="num">{t('m01.fs05.panel.version', { n: f.num(base.version) })}</span>}
            {!draft && base && <span className="text-ink-3">{t('m01.fs05.edit.startsDraft')}</span>}
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(['added', 'raised', 'dropped'] as const).map((k) => (
              <div key={k} className="rounded-card bg-sunken p-2">
                <dt className="text-[11.5px] text-ink-3">{t(`m01.fs05.edit.size.${k}`)}</dt>
                <dd className="num text-[18px] font-semibold">{f.num(size[k])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[12px] text-ink-3">{prev ? t('m01.fs05.panel.vs', { h: t(`m01.fs05.h.${prevH}`) }) : t('m01.fs05.panel.today')}</p>
        </Card>
        <Card title={t('m01.fs05.edit.checks')}>
          <ul className="space-y-1.5 text-[13px]" data-testid="m01-edit-checks" aria-live="polite">
            <li className="flex gap-1.5">
              <Icon name={saveCode === 'ok' ? 'check' : 'alert'} size={14} className={saveCode === 'ok' ? 'text-ok' : 'text-bad'} />
              {saveCode === 'ok' ? t('m01.fs05.edit.okDraft') : t(`m01.fs05.check.${saveCode}`)}
            </li>
            <li className="flex gap-1.5">
              <Icon name={pubCode === 'ok' ? 'check' : 'alert'} size={14} className={pubCode === 'ok' ? 'text-ok' : 'text-sim'} />
              {pubCode === 'ok' ? t('m01.fs05.edit.okPublish') : t(`m01.fs05.check.${pubCode}`)}
            </li>
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">{t('m01.fs05.edit.checksNote')}</p>
        </Card>
      </Grid>

      {!sec && (
        <Section title={t('m01.fs05.edit.reqs')} description={t('m01.fs05.edit.reqsDesc')}>
          {reqs.length === 0 ? (
            <EmptyState title={t('m01.fs05.edit.noReqs')} />
          ) : (
            <ul className="space-y-2" data-testid="m01-edit-reqs">
              {reqs.map((r) => (
                <li key={r._k} className="card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">
                      <span className="me-1.5 text-[11px] uppercase text-ink-3">{t(`m01.fs05.kind.${r.kind}`)}</span>
                      {label(r)}
                    </div>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setReqs((rs) => rs.filter((x) => x._k !== r._k))} aria-label={t('m01.fs05.edit.remove', { name: label(r) })}>
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <SelectField label={t('m01.fs05.panel.level')} name={`lv-${r._k}`} value={String(r.level)} onChange={(v) => patch(r._k, { level: Number(v) || 1 })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${f.num(n)} · ${pick(p.levels.get(n), 'name')}` }))} />
                    <SelectField label={t('m01.fs05.panel.importance')} name={`im-${r._k}`} value={r.importance} onChange={(v) => patch(r._k, { importance: (v || 'useful') as ProfileReq['importance'] })} options={IMPORTANCE.map((x) => ({ value: x, label: t(`m01.importance.${x}`) }))} />
                    <SelectField label={t('m01.fs05.edit.driver')} name={`dr-${r._k}`} value={r.driver ?? ''} placeholder={t('m01.fs05.edit.noDriver')} onChange={(v) => patch(r._k, { driver: (v || null) as ProfileReq['driver'] })} options={DRIVERS.map((x) => ({ value: x, label: t(`m01.fs05.driver.${x}`) }))} />
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <TextField label={t('m01.fs05.edit.whyEn')} name={`we-${r._k}`} value={r.why_en ?? ''} onChange={(v) => patch(r._k, { why_en: v })} />
                    <TextField label={t('m01.fs05.edit.whyAr')} name={`wa-${r._k}`} value={r.why_ar ?? ''} onChange={(v) => patch(r._k, { why_ar: v })} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Card>
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]" data-testid="m01-edit-add">
              <SelectField label={t('m01.fs05.edit.addKind')} name="add-kind" value={addKind} onChange={(v) => { setAddKind((v || 'skill') as 'competency' | 'skill'); setAddRef(''); }} options={[{ value: 'skill', label: t('m01.fs05.kind.skill') }, { value: 'competency', label: t('m01.fs05.kind.competency') }]} />
              <SelectField label={t('m01.fs05.edit.addRef')} name="add-ref" value={addRef} onChange={setAddRef} options={options} />
              <button type="button" className="btn-outline" onClick={add} disabled={!addRef} data-testid="m01-edit-add-btn">
                <Icon name="plus" size={13} className="me-1 inline" />
                {t('m01.fs05.edit.add')}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-ink-3">{t('m01.fs05.edit.securityNote')}</p>
          </Card>
        </Section>
      )}

      <Section title={t('m01.fs05.edit.rationale')}>
        <Grid cols={2}>
          <TextArea label={t('m01.fs05.edit.ratEn')} name="rat-en" value={ratEn} onChange={setRatEn} rows={4} />
          <TextArea label={t('m01.fs05.edit.ratAr')} name="rat-ar" value={ratAr} onChange={setRatAr} rows={4} />
        </Grid>
      </Section>

      <Section title={t('m01.sources')} description={t('m01.fs05.edit.sourcesDesc')}>
        <ul className="space-y-1" data-testid="m01-edit-sources">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-semibold">{s.label}</span>
              <span className="truncate text-ink-3" dir="ltr">{s.url}</span>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSources((xs) => xs.filter((_, j) => j !== i))} aria-label={t('m01.fs05.edit.remove', { name: s.label })}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <TextField label={t('m01.fs05.edit.srcLabel')} name="src-label" value={srcLabel} onChange={setSrcLabel} />
          <TextField label={t('m01.fs05.edit.srcUrl')} name="src-url" value={srcUrl} onChange={setSrcUrl} placeholder="https://" />
          <button
            type="button"
            className="btn-outline"
            disabled={!srcLabel.trim() || !/^https:\/\//.test(srcUrl)}
            onClick={() => {
              setSources((xs) => [...xs, { id: `src-${xs.length + 1}`, label: srcLabel.trim(), url: srcUrl.trim(), as_of: new Date().toISOString().slice(0, 10) }]);
              setSrcLabel('');
              setSrcUrl('');
            }}
          >
            {t('m01.fs05.edit.addSource')}
          </button>
        </div>
      </Section>

      <div className="sticky bottom-3 z-20">
        <div className="card flex flex-wrap items-center justify-between gap-2 border-accent p-3 shadow-lg">
          <span className="text-[12.5px] text-ink-2">{t('m01.fs05.edit.footer')}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" disabled={busy || saveCode !== 'ok'} onClick={() => save(false)} data-testid="m01-edit-save">
              {t('m01.fs05.edit.saveDraft')}
            </button>
            <button type="button" className="btn-primary" disabled={busy || pubCode !== 'ok'} onClick={() => setConfirm(true)} data-testid="m01-edit-publish">
              {t('m01.fs05.edit.publish')}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m01.fs05.edit.confirmTitle', { h: t(`m01.fs05.h.${h}`) })}
        consequence={t('m01.fs05.edit.confirmBody')}
        confirmLabel={t('m01.fs05.edit.publish')}
        onConfirm={async () => {
          const r = await save(true);
          if (r.ok) setConfirm(false);
        }}
      />
    </>
  );
}

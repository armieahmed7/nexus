// FS59 /learn/role-play (internal_content R): the ENEC-authored role-play practice library. Six conversation kinds a nuclear professional
// has to get right (pre-job brief, shift turnover, raising a concern to a senior, regulator-style interview practice, knowledge transfer,
// coaching a peer on AI output), each with its setting, the counterpart, the turns and the published deterministic rubric in English and
// Arabic side by side, so anyone can see exactly what the check looks for before practising. Practice is private (/my/role-play).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, EmptyState, BenchmarkChips, Drawer, Icon, FilterBar, useFilters } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { RP_KINDS, type RpCriterion } from './roleplay';
import { CheckText, KindTag } from './fs65ui';
import { useCoreName, useM33Ref, type M33Ref, type Row } from './ui';

export function useRpLibrary() {
  const repo = useRepo();
  return useQuery(['roleplay_scenarios'], async () => ((await repo.list('roleplay_scenarios' as never, { order: [['sort', 'asc']] } as never)) as Row[]), []);
}

export default function RolePlayLibraryPage() {
  const t = useT();
  const ref = useM33Ref();
  const q = useRpLibrary();
  return (
    <Page title={t('m33.routes.learn-role-play.title')} intro={t('m33.rp.lib.intro')} wide eyebrow={<BenchmarkChips feature="FS59" />}>
      <Async state={ref}>{(d) => <Async state={q} isEmpty={() => false}>{(rows) => <Library d={d} rows={rows.filter((r) => r.status === 'published')} />}</Async>}</Async>
    </Page>
  );
}

function Library({ d, rows }: { d: M33Ref; rows: Row[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const coreName = useCoreName(d);
  const [open, setOpen] = useState<Row | null>(null);
  const [flt, setFlt] = useFilters({ q: '', kind: '' }, true);
  const canPractise = s.can('skills_profile', ['Own']);
  const shown = useMemo(() => rows
    .filter((r) => !flt.kind || r.kind === flt.kind)
    .filter((r) => !flt.q || `${r.code} ${r.title_en} ${r.title_ar} ${r.summary_en} ${r.summary_ar}`.toLowerCase().includes(flt.q.toLowerCase())), [rows, flt]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card eyebrow={t('m33.rp.lib.how.eyebrow')} title={t('m33.rp.lib.how.title')} className="lg:col-span-2">
          <ol className="grid grid-cols-1 gap-2 text-[13px] text-ink-2 sm:grid-cols-2" data-testid="m33-rp-how">
            {['s1', 's2', 's3', 's4'].map((k, i) => (
              <li key={k} className="flex gap-2 rounded-card border border-line bg-panel p-2.5">
                <span className="num inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] text-eyebrow">{f.num(i + 1)}</span>{t(`m33.rp.lib.how.${k}`)}
              </li>
            ))}
          </ol>
        </Card>
        <Card eyebrow={t('m33.rp.lib.kinds')} title={t('m33.rp.lib.kindsTitle', { n: f.num(RP_KINDS.length) })}>
          <ul className="space-y-1.5" data-testid="m33-rp-kinds">
            {RP_KINDS.map((k) => <li key={k} className="flex items-center justify-between gap-2 text-[13px]"><KindTag kind={k} /><span className="num text-ink-3">{f.num(rows.filter((r) => r.kind === k).length)}</span></li>)}
          </ul>
        </Card>
      </div>

      <Section title={t('m33.rp.lib.list', { n: f.num(rows.length) })} description={t('m33.rp.lib.listIntro')}>
        <FilterBar value={flt} onChange={setFlt} search="q" fields={[{ key: 'kind', label: t('m33.rp.col.kind'), options: RP_KINDS.map((k) => ({ value: k, label: t(`m33.rp.kind.${k}`) })) }]} />
        {shown.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m33-rp-library">
            {shown.map((r) => (
              <Card key={r.id} as="article" className="flex flex-col">
                <div className="flex h-full flex-col gap-2" data-testid="m33-rp-scenario" data-id={r.id}>
                  <div className="flex flex-wrap items-center gap-1.5"><KindTag kind={r.kind} /><span className="text-[11.5px] text-ink-3">{t('m33.aps.minutes', { n: f.num(r.est_minutes) })} · {t('m33.rp.turnsN', { n: f.num((r.turns ?? []).length) })}</span></div>
                  <div className="font-semibold"><span className="num me-1.5 text-[11.5px] text-ink-3">{r.code}</span>{pick(r, 'title')}</div>
                  <p className="text-[13px] text-ink-2">{pick(r, 'summary')}</p>
                  <p className="text-[12px] text-ink-3"><Icon name="user" size={12} className="me-1 inline" />{t('m33.rp.counterpart')}: {pick(r, 'counterpart')}</p>
                  <div className="flex flex-wrap gap-1">{(r.core_skill_ids ?? []).map((id: string) => <L key={id} to={`/learn/core-skills/${id}`} className="chip border-line bg-panel normal-case tracking-normal text-ink-2">{coreName(id)}</L>)}</div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(r)} data-testid="m33-rp-open-rubric">{t('m33.rp.lib.rubric', { n: f.num((r.rubric ?? []).length) })}</button>
                    {canPractise && <L to={`/my/role-play/${r.id}`} className="btn-primary btn-sm no-underline" data-testid="m33-rp-practise">{t('m33.rp.practise')}</L>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : <EmptyState title={t('m33.rp.lib.none')} />}
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="info" title={t('m33.rp.lib.private.title')}>{t('m33.rp.lib.private.body')}</Callout>
        <Callout tone="sim" title={t('m33.rp.speak.title')}>{t('m33.rp.speak.body')} <L to="/speak-up" className="font-semibold">{t('m33.rp.speak.link')}</L></Callout>
      </div>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${open.code} · ${pick(open, 'title')}` : ''}>
        {open && <ScenarioDetail r={open} />}
      </Drawer>
    </div>
  );
}

/** Setting, counterpart, my role, turns and the published rubric in both languages (the acceptance: every scenario's rubric in EN and AR). */
export function ScenarioDetail({ r }: { r: Row }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <div className="space-y-5 text-[13.5px]" data-testid="m33-rp-detail" data-id={r.id}>
      <div className="flex flex-wrap items-center gap-2"><KindTag kind={r.kind} /><span className="text-[12px] text-ink-3">{t('m33.rp.levelPass', { level: f.num(r.level), pct: f.num(r.pass_pct) })}</span></div>
      <p className="text-ink-2">{pick(r, 'setting')}</p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-card border border-line p-2"><dt className="caps text-[10.5px]">{t('m33.rp.counterpart')}</dt><dd>{pick(r, 'counterpart')}</dd></div>
        <div className="rounded-card border border-line p-2"><dt className="caps text-[10.5px]">{t('m33.rp.yourRole')}</dt><dd>{pick(r, 'role')}</dd></div>
      </dl>
      <div>
        <h3 className="caps mb-1">{t('m33.rp.turnsTitle')}</h3>
        <ol className="list-decimal space-y-1 ps-5 text-ink-2">{(r.turns ?? []).map((x: Row) => <li key={x.id}>{pick(x, 'prompt')}</li>)}</ol>
      </div>
      {(['en', 'ar'] as const).map((lng) => (
        <div key={lng} dir={lng === 'ar' ? 'rtl' : 'ltr'} lang={lng} className="space-y-2" data-testid={`m33-rp-rubric-${lng}`}>
          <h3 className="caps">{t('m33.rp.rubricIn', { lang: t(`m33.bank.lang.${lng}`) })}</h3>
          <ol className="space-y-1.5">
            {(r.rubric as RpCriterion[]).map((c) => (
              <li key={c.id} className="rounded-md border border-line px-2 py-1.5" data-criterion={c.id}>
                <div className="font-semibold">{c[`label_${lng}`]}</div>
                <p className="text-[12.5px] text-ink-2">{c[`desc_${lng}`]}</p>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <div>
        <h3 className="caps mb-1">{t('m33.rp.checksTitle')}</h3>
        <ul className="space-y-1">{(r.rubric as RpCriterion[]).map((c) => <li key={c.id}><span className="me-1 font-semibold">{pick(c as unknown as Row, 'label')}:</span><CheckText c={c} /></li>)}</ul>
      </div>
      <p className="text-[12px] text-ink-3">{t('m33.rp.sources', { n: f.num((r.sources ?? []).length) })}</p>
    </div>
  );
}


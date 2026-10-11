// FS36 /workspace/ai-register/:id (ai_literacy R): one register entry. ENEC's role, approved-use class, maturity label, owner, the
// human-oversight rule, the literacy measures, sources, and every user group with its required rung, who is in it, and its coverage
// (computed from FS09 rungs, suppressed under 10) with the most common gaps. Staff see whether their own rung meets their group.
import { useParams } from 'react-router-dom';
import { Page, Section, Card, Async, Callout, EmptyState, KeyValue, BenchmarkChips, SourceLink, DataTable, WhyThis, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, usePick, useT } from '../../i18n';
import { isCovered, isMember } from './register';
import { CoverageBar, CoverageWhy, Gaps, GroupRequirement, GroupWho, LabelCheck, MeasureLink, SystemChips, useRegister, type RegisterData } from './fs36ui';
import { RungPill, type Row } from './ui';
import type { AiFluencyView } from './backend/rpc';

export default function SystemPage() {
  const t = useT();
  const pick = usePick();
  const { id = '' } = useParams();
  const q = useRegister();
  const repo = useRepo();
  const s = useSession();
  const mine = useQuery(['person_skills'], () => repo.rpc.aiFluency().catch(() => null), [s.identity.personId]);
  return (
    <Async state={q}>{(d) => {
      const sys = d.systems.find((x) => x.id === id);
      return (
        <Page title={sys ? pick(sys, 'name') : t('m29.routes.workforce-ai-system.title')} intro={sys ? t('m29.sys.intro') : t('m29.sys.notFound')} wide eyebrow={<BenchmarkChips feature="FS36" />}
          actions={<L to="/workforce/ai-register" className="btn-outline btn-sm no-underline" data-testid="m29-sys-back">{t('m29.sys.back')}</L>}>
          {sys ? <Body d={d} sys={sys} me={mine.data ?? null} /> : <EmptyState title={t('m29.sys.notFound')} />}
        </Page>
      );
    }}</Async>
  );
}

function Body({ d, sys, me }: { d: RegisterData; sys: Row; me: AiFluencyView | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const groups = d.groups.filter((g) => g.system_id === sys.id);
  const sc = d.cov?.systems.find((x) => x.system_id === sys.id);
  const p = me ? { person_id: me.person_id, family_id: me.family_id, rung: me.result.rung, met: me.result.cells.filter((c) => c.met).map((c) => c.id) } : null;
  const myGroups = p ? groups.filter((g) => isMember(g as never, p)) : [];
  const cols: Column<Row>[] = [
    { key: 'group', header: t('m29.sys.col.group'), value: (g) => pick(g, 'label'), render: (g) => <span className="flex flex-col"><span className="font-semibold">{pick(g, 'label')}</span><span className="text-[12px] text-ink-3"><GroupWho g={g} families={d.families} /></span></span> },
    { key: 'side', header: t('m29.sys.col.side'), value: (g) => t(`m29.reg.side.${g.side}`) },
    { key: 'needs', header: t('m29.sys.col.needs'), value: (g) => g.required_rung, render: (g) => <GroupRequirement g={g} cells={d.cells} /> },
    { key: 'n', header: t('m29.sys.col.n'), value: (g) => sc?.groups.find((x) => x.group_id === g.id)?.n ?? -1, render: (g) => { const gc = sc?.groups.find((x) => x.group_id === g.id); return !sc ? '—' : gc?.n == null ? <span className="text-ink-3">{t('common.suppressedShort')}</span> : f.num(gc.n); }, align: 'end' },
    { key: 'cov', header: t('m29.sys.col.cov'), value: (g) => sc?.groups.find((x) => x.group_id === g.id)?.pct ?? -1, render: (g) => <div className="min-w-[10rem]"><CoverageBar c={sc ? sc.groups.find((x) => x.group_id === g.id) ?? null : undefined} label={pick(g, 'label')} compact /></div> },
    { key: 'gaps', header: t('m29.sys.col.gaps'), value: () => '', render: (g) => <Gaps gc={sc?.groups.find((x) => x.group_id === g.id)} cells={d.cells} /> },
  ];
  return (
    <div className="space-y-6" data-testid="m29-sys" data-id={sys.id}>
      <div className="space-y-2">
        <SystemChips s={sys} />
        <p className="max-w-3xl text-[14px] text-ink-2">{pick(sys, 'purpose')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t('m29.sys.facts')} className="lg:col-span-1">
          <KeyValue items={[
            [t('m29.reg.owner'), pick(sys, 'owner')],
            [t('m29.sys.role'), t(`m29.reg.roleLong.${sys.ai_role}`)],
            [t('m29.sys.use'), t(`m29.reg.use.${sys.use_class}`)],
            [t('m29.sys.version'), f.num(Number(sys.version))],
            [t('m29.sys.review'), sys.review_due ? f.date(String(sys.review_due)) : '—'],
            [t('m29.sys.asOf'), f.date(String(sys.as_of))],
          ]} />
        </Card>
        <div className="space-y-4 lg:col-span-2">
          <Callout tone="info" title={t('m29.sys.oversight')}><span data-testid="m29-sys-oversight">{pick(sys, 'oversight')}</span></Callout>
          <Card title={t('m29.sys.coverage')} eyebrow={t('m29.sys.coverageEyebrow')} actions={<span className="flex items-center gap-2"><LabelCheck sc={sc} /><CoverageWhy sc={sc} /></span>}>
            <CoverageBar c={sc ?? (d.cov ? null : undefined)} label={t('m29.reg.cov.system')} />
            {sc && <p className="mt-2 text-[12.5px] text-ink-3">{t('m29.sys.coverageNote', { n: sc.n == null ? t('common.suppressedShort') : f.num(sc.n) })}</p>}
          </Card>
        </div>
      </div>

      {myGroups.length > 0 && me && (
        <Card title={t('m29.sys.you.title')} eyebrow={t('m29.sys.you.eyebrow')}>
          <ul className="space-y-2" data-testid="m29-sys-you">
            {myGroups.map((g) => {
              const ok = isCovered(g as never, p!);
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-2 text-[13px]" data-ok={ok ? 'yes' : 'no'}>
                  <span className="font-semibold">{pick(g, 'label')}</span>
                  <span className="text-ink-3">{t('m29.reg.mine.needs')}</span> <GroupRequirement g={g} cells={d.cells} />
                  <span className="text-ink-3">{t('m29.reg.mine.you')}</span> <RungPill rung={me.result.rung} />
                  <span className={ok ? 'text-ok' : 'text-ink-2'}>{ok ? t('m29.reg.mine.met') : t('m29.reg.mine.notYet')}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px]"><WhyThis reasons={me.result.reasons} testId="m29-sys-you-why" /><L to="/my/ai-fluency/drills">{t('m29.reg.mine.drills')}</L></div>
        </Card>
      )}

      <Section title={t('m29.sys.groups.title')} description={t('m29.sys.groups.intro')}>
        <div data-testid="m29-sys-groups">
          <DataTable rows={groups} columns={cols} rowKey={(g) => g.id} searchable={false} caption={t('m29.sys.groups.title')} csvName={`ai-register-${sys.id}.csv`} />
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.sys.measures')} eyebrow={t('m29.sys.measuresEyebrow')}>
          <ul className="space-y-1.5" data-testid="m29-sys-measures">{(sys.measures ?? []).map((m: Row, i: number) => <MeasureLink key={i} m={m} />)}</ul>
        </Card>
        <Card title={t('m29.sys.sources')}>
          <ul className="space-y-1 text-[13px]" data-testid="m29-sys-sources">
            {(sys.sources ?? []).map((x: Row) => <li key={x.url}><SourceLink href={x.url} date={String(sys.as_of)}>{x.label}</SourceLink></li>)}
            {!(sys.sources ?? []).length && <li className="text-ink-3">{t('m29.sys.noSources')}</li>}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">{t('m29.reg.notRegulator.body')}</p>
        </Card>
      </div>
    </div>
  );
}

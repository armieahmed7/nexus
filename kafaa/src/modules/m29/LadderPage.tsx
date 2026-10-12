// FS09 /learn/ai-fluency (public): the AI Fluency Ladder. Four rungs (Aware, Practitioner, Builder, Assurer) across the four UNESCO
// AI competency dimensions, each cell with a plant example, the literacy skills that evidence it and the learning that gets there;
// AI literacy kept apart from AI engineering; the target rung for each of the 20 job families. Definitions are public reference rows.
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, Callout, BenchmarkChips, Icon, SelectField } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { DIMENSIONS, RUNG_KEYS } from './fluency';
import { DimHead, LearningList, RungPill, SkillChips, TargetLine, useM29Ref, type M29Ref, type Row } from './ui';

export default function LadderPage() {
  const t = useT();
  const q = useM29Ref();
  return (
    <Page title={t('m29.routes.learn-ai-fluency.title')} intro={t('m29.lad.intro')} wide eyebrow={<BenchmarkChips feature="FS09" />}
      actions={<L to="/pathways/journey/starter" className="btn-outline btn-sm no-underline" data-testid="m29-lad-to-starter">{t('m29.lad.toStarter')}</L>}>{/* FS77 (wave-H integration) */}
      <Async state={q}>{(d) => <Ladder d={d} />}</Async>
    </Page>
  );
}

function Ladder({ d }: { d: M29Ref }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const s = useSession();
  const [dim, setDim] = useState<string>('');
  const rungs = [4, 3, 2, 1];
  const byRung = (r: number) => d.cells.filter((c: Row) => c.rung === r);
  const lit = d.tracks.filter((x: Row) => x.track === 'literacy');
  const eng = d.tracks.filter((x: Row) => x.track === 'engineering');
  const families = useMemo(() => [...d.families].sort((a: Row, b: Row) => (a.sort ?? 0) - (b.sort ?? 0)), [d.families]);
  const dims = dim ? [dim] : [...DIMENSIONS];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="m29-lad-rungs">
        {[1, 2, 3, 4].map((r) => {
          const c = byRung(r)[0];
          return (
            <Card key={r} eyebrow={t('m29.lad.rungN', { n: f.num(r) })} title={<span className="flex items-center gap-2"><RungPill rung={r} />{r === 2 && <span className="caps text-[10.5px] text-ok">{t('m29.lad.indicatorRung')}</span>}</span>}>
              <p className="text-[13.5px] text-ink-2">{c ? pick(c, 'essence') : ''}</p>
            </Card>
          );
        })}
      </div>

      <Section title={t('m29.lad.grid.title')} description={t('m29.lad.grid.intro')}
        actions={<div className="w-56"><SelectField name="m29-dim" label={t('m29.lad.grid.dimFilter')} value={dim} onChange={setDim} placeholder={t('m29.lad.grid.allDims')}
          options={DIMENSIONS.map((x) => ({ value: x, label: t(`m29.dim.${x}`) }))} /></div>}>
        <div className="card overflow-x-auto" data-testid="m29-lad-grid">
          <table className="w-full min-w-[640px] table-fixed text-[13px]">
            <caption className="sr-only">{t('m29.lad.grid.title')}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="caps w-28 px-3 py-2 text-start">{t('m29.lad.grid.rung')}</th>
                {dims.map((x) => <th key={x} scope="col" className="px-3 py-2 text-start align-bottom"><DimHead dim={x} /></th>)}
              </tr>
            </thead>
            <tbody>
              {rungs.map((r) => (
                <tr key={r} className="border-b border-line/60 align-top" data-rung={r}>
                  <th scope="row" className="px-3 py-3 text-start"><RungPill rung={r} /></th>
                  {dims.map((x) => {
                    const c = d.cells.find((y: Row) => y.rung === r && y.dimension === x);
                    if (!c) return <td key={x} />;
                    return (
                      <td key={x} className="space-y-2 px-3 py-3" data-testid="m29-lad-cell" data-cell={c.id}>
                        <p className="text-ink">{pick(c, 'descriptor')}</p>
                        <p className="rounded-md bg-sunken px-2 py-1.5 text-[12.5px] text-ink-2"><span className="caps me-1 text-[10.5px]">{t('m29.lad.grid.example')}</span>{pick(c, 'example')}</p>
                        <SkillChips ids={c.skill_ids} data={d} level={c.min_level} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="info" title={t('m29.lad.spiral.title')}>{t('m29.lad.spiral.body')}</Callout>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m29.lad.tracks.title')} eyebrow={t('m29.lad.tracks.eyebrow')}>
          <p className="mb-3 text-[13px] text-ink-2">{t('m29.lad.tracks.intro')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="m29-lad-tracks">
            <div>
              <h3 className="caps mb-1.5 text-ok">{t('m29.track.literacy')}</h3>
              <ul className="space-y-1 text-[13px]">{lit.map((x: Row) => <li key={x.id} className="flex items-start gap-1.5"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-ok" /><span title={pick(x, 'rationale')}>{pick(d.skills.find((k: Row) => k.id === x.skill_id) ?? x, 'name') || x.skill_id}</span></li>)}</ul>
            </div>
            <div>
              <h3 className="caps mb-1.5 text-ink-3">{t('m29.track.engineering')}</h3>
              <ul className="space-y-1 text-[13px]" data-testid="m29-lad-engineering">{eng.map((x: Row) => <li key={x.id} className="flex items-start gap-1.5"><Icon name="lock" size={13} className="mt-0.5 shrink-0 text-ink-3" /><span title={pick(x, 'rationale')}>{pick(d.skills.find((k: Row) => k.id === x.skill_id) ?? x, 'name') || x.skill_id}</span></li>)}</ul>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3">{t('m29.lad.tracks.note')}</p>
        </Card>
        <Card title={t('m29.lad.how.title')} eyebrow={t('m29.lad.how.eyebrow')}>
          <ol className="list-decimal space-y-1.5 ps-5 text-[13px] text-ink-2">
            <li>{t('m29.lad.how.s1')}</li>
            <li>{t('m29.lad.how.s2')}</li>
            <li>{t('m29.lad.how.s3')}</li>
            <li>{t('m29.lad.how.s4')}</li>
          </ol>
          <div className="mt-3">
            <h3 className="caps mb-1.5">{t('m29.lad.how.learn')}</h3>
            <LearningList items={d.cells.find((c: Row) => c.id === 'air:2:ethics')?.learning ?? []} d={d} />
          </div>
          {s.status === 'signed_in'
            ? <L to="/my/ai-fluency" className="btn-primary mt-4 inline-flex no-underline" data-testid="m29-lad-mine">{t('m29.lad.cta.mine')}</L>
            : <L to="/sign-in" className="btn-outline mt-4 inline-flex no-underline" data-testid="m29-lad-signin">{t('m29.lad.cta.signin')}</L>}
        </Card>
      </div>

      <Section title={t('m29.lad.targets.title')} description={t('m29.lad.targets.intro')}>
        <div className="card overflow-x-auto">
          <table className="w-full text-[13px]" data-testid="m29-lad-targets">
            <caption className="sr-only">{t('m29.lad.targets.title')}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="caps px-3 py-2 text-start">{t('m29.lad.targets.family')}</th>
                <th scope="col" className="caps px-3 py-2 text-start">{t('m29.lad.targets.target')}</th>
                <th scope="col" className="caps hidden px-3 py-2 text-end sm:table-cell">{t('m29.lad.targets.score')}</th>
                <th scope="col" className="caps hidden px-3 py-2 text-start md:table-cell">{t('m29.lad.targets.why')}</th>
              </tr>
            </thead>
            <tbody>
              {families.map((fam: Row) => {
                const tg = d.targets.find((x: Row) => x.family_id === fam.id);
                return (
                  <tr key={fam.id} className="border-b border-line/60 align-top" data-family={fam.id}>
                    <td className="px-3 py-2 font-medium">{pick(fam, 'name')}</td>
                    <td className="px-3 py-2"><TargetLine target={tg} d={d} /></td>
                    <td className="num hidden px-3 py-2 text-end sm:table-cell">{tg ? f.num(tg.fitness_target) : '—'}</td>
                    <td className="hidden px-3 py-2 text-ink-2 md:table-cell">{tg ? pick(tg, 'rationale') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Callout tone="ok" title={t('m29.lad.noGame.title')}>{t('m29.lad.noGame.body')}</Callout>
      <p className="text-[12px] text-ink-3" data-testid="m29-lad-keys">{RUNG_KEYS.map((k, i) => `${f.num(i + 1)} ${t(`m29.rung.${k}`)}`).join(' · ')}</p>
    </div>
  );
}

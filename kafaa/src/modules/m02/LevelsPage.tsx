// FS23 /competencies/levels · How levels work (public): the four-level Kafa'a scale with SFIA 9 style generic attributes (autonomy,
// influence, complexity, knowledge, behaviours) and a one-line essence per level, the "not yet" state below and the Authority recognition
// above (FS24; a recognition, never a fifth level), why skills are defined only at the levels where they exist (published rationale per
// basis, SFIA 9), the behavioural track and the evidence modes assessors use (IAEA-TECDOC-1917).
import { useMemo } from 'react';
import { Async, BenchmarkChips, Callout, Card, EmptyState, Page, Section, StatTile, StatusPill, Tabs, WhyThis } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { EVIDENCE_MODES, RANGE_BASES } from './descriptors';
import { BasisPill, LEVELS, RangeDots, useLevelName, useLevelsData, type LevelsData } from './levelsUi';

const ATTRS = ['autonomy', 'influence', 'complexity', 'knowledge', 'behaviours'] as const;

export default function LevelsPage() {
  const t = useT();
  const q = useLevelsData();
  return (
    <Page title={t('m02.routes.competencies-levels.title')} eyebrow={t('m02.lv.eyebrow')} intro={t('m02.lv.intro')} wide
      actions={<><L to="/competencies/descriptors" className="btn-primary">{t('m02.lv.toLibrary')}</L><L to="/competencies/scale" className="btn-outline">{t('m02.lv.toScale')}</L></>}>
      <div data-testid="m02-bench-fs23"><BenchmarkChips feature="FS23" /></div>
      <Async state={q} isEmpty={(d) => d.attrs.length === 0} empty={<EmptyState title={t('m02.lv.empty')} />}>{(d) => <Body d={d} />}</Async>
    </Page>
  );
}

function Body({ d }: { d: LevelsData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const levelName = useLevelName();
  const attr = (lv: number, a: string) => d.attrs.find((x) => x.level === lv && x.attribute === a);
  const byBasis = useMemo(() => RANGE_BASES.map((b) => ({ b, rows: d.ranges.filter((r) => r.basis === b) })).filter((x) => x.rows.length), [d.ranges]);
  const behavioural = d.ranges.filter((r) => r.track === 'behavioural').length;
  const pub = d.descs.filter((x) => x.status === 'published');
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="m02-lv-tiles">
        <StatTile label={t('m02.lv.tSkills')} value={f.num(new Set(pub.map((x) => x.skill_id)).size)} sub={t('m02.lv.tSkillsSub', { n: f.num(d.skills.length) })} tone="ok" />
        <StatTile label={t('m02.lv.tLevels')} value={f.num(pub.length)} sub={t('m02.lv.tLevelsSub')} />
        <StatTile label={t('m02.lv.tIndicators')} value={f.num(pub.reduce((n, x) => n + (x.indicators_en?.length ?? 0), 0))} sub={t('m02.lv.tIndicatorsSub')} tone="info" />
        <StatTile label={t('m02.lv.tBehavioural')} value={f.num(behavioural)} sub={t('m02.lv.tBehaviouralSub')} />
      </div>

      <Section title={t('m02.lv.scaleTitle')} description={t('m02.lv.scaleDesc')}>
        <ol className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6" data-testid="m02-lv-scale">
          <li className="card border-dashed p-3">
            <div className="caps">{t('m02.sc.band.not_yet')}</div>
            <p className="mt-1 text-[13px] text-ink-2">{t('m02.lv.notYetBody')}</p>
          </li>
          {LEVELS.map((lv) => (
            <li key={lv} className="card p-3" data-testid={`m02-lv-level-${lv}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="num text-[22px] font-semibold text-accent">{f.num(lv)}</span>
                <span className="chip border-line bg-sunken normal-case tracking-normal" title={t('m02.lv.sfiaHint')}>SFIA <bdi className="num ms-1">{(attr(lv, 'essence')?.sfia_levels ?? '').split('-').map((x: string) => f.num(Number(x), { useGrouping: false })).join('–')}</bdi></span>
              </div>
              <div className="font-semibold">{levelName(lv)}</div>
              <p className="mt-1 text-[13px] text-ink-2">{pick(attr(lv, 'essence'), 'text')}</p>
            </li>
          ))}
          <li className="card border-accent/40 bg-accent-soft/40 p-3" data-testid="m02-lv-authority">
            <div className="caps text-eyebrow">{t('m02.sc.band.authority')}</div>
            <p className="mt-1 text-[13px] text-ink-2">{t('m02.lv.authorityBody')}</p>
            <StatusPill tone="info">{t('m02.lv.notALevel')}</StatusPill>
          </li>
        </ol>
      </Section>

      <Section title={t('m02.lv.attrsTitle')} description={t('m02.lv.attrsDesc')}>
        <Card padded={false}>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[13px]" data-testid="m02-lv-attrs">
              <caption className="sr-only">{t('m02.lv.attrsTitle')}</caption>
              <thead>
                <tr className="border-b border-line text-start">
                  <th scope="col" className="p-3 text-start caps">{t('m02.lv.attribute')}</th>
                  {LEVELS.map((lv) => <th key={lv} scope="col" className="p-3 text-start caps">{levelName(lv)}</th>)}
                </tr>
              </thead>
              <tbody>
                {ATTRS.map((a) => (
                  <tr key={a} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="w-40 p-3 text-start font-semibold">{pick(attr(1, a), 'name')}</th>
                    {LEVELS.map((lv) => <td key={lv} className="p-3 text-ink-2">{pick(attr(lv, a), 'text')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:hidden">
            <Tabs tabs={LEVELS.map((lv) => ({ id: String(lv), label: levelName(lv), content: (
              <dl className="space-y-2 pt-2 text-[13px]">
                {ATTRS.map((a) => <div key={a}><dt className="font-semibold">{pick(attr(lv, a), 'name')}</dt><dd className="text-ink-2">{pick(attr(lv, a), 'text')}</dd></div>)}
              </dl>
            ) }))} />
          </div>
        </Card>
      </Section>

      <Section title={t('m02.lv.rangesTitle')} description={t('m02.lv.rangesDesc')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m02-lv-bases">
          {byBasis.map(({ b, rows }) => {
            const ex = rows.slice(0, 3).map((r) => d.skill.get(r.skill_id)).filter(Boolean);
            const sample = rows[0];
            return (
              <Card key={b} as="li" title={<span className="flex flex-wrap items-center gap-2"><BasisPill basis={b} /><span className="text-[13px] font-normal text-ink-3">{t('m02.lv.nSkills', { n: f.num(rows.length) })}</span></span>}>
                <div className="flex items-center gap-2"><RangeDots range={sample} /><WhyThis reasons={[{ code: b, key: `m02.lv.why.basis.${b}` }, { code: 'sfia', key: 'm02.lv.why.sfia' }]} testId={`m02-lv-why-${b}`} /></div>
                <p className="mt-2 text-[13px] text-ink-2">{t(`m02.lv.basisBody.${b}`)}</p>
                <p className="mt-2 text-[12.5px]">
                  <span className="text-ink-3">{t('m02.lv.examples')} </span>
                  {ex.map((s, i) => <span key={s.id}>{i > 0 && ' · '}<L to={`/competencies/descriptors/${s.id}`}>{pick(s, 'name')}</L></span>)}
                </p>
              </Card>
            );
          })}
        </ul>
      </Section>

      <Section title={t('m02.lv.trackTitle')} description={t('m02.lv.trackDesc')}>
        <Callout tone="info" title={t('m02.lv.trackCallout')}>{t('m02.lv.trackBody', { n: f.num(behavioural) })}</Callout>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="m02-lv-modes">
          {EVIDENCE_MODES.map((m) => (
            <li key={m} className="card p-3">
              <div className="font-semibold">{t(`m02.lv.mode.${m}`)}</div>
              <p className="text-[12.5px] text-ink-2">{t(`m02.lv.modeHint.${m}`)}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

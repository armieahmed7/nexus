// FS29/FS30 /recognition · Recognition of prior learning and learning credits (public). How RPL works (request, an evidence pack from
// your own records, two assessors, full / partial / not-yet credit, an NQC-ready export); what counts as evidence and what never does
// (security-restricted records); indicative NQF levels per Kafa'a level (FS24 published map, data-only), the credit rule, the 30-credit
// stacks and the public catalogue of tagged learning. Kafa'a is not a licensing, regulatory or awarding authority.
import { useSearchParams } from 'react-router-dom';
import { Async, Card, DataTable, EmptyState, FilterBar, Icon, Page, Section, SourceLink, StatusPill, Stepper, Tabs, useFilters, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { EVIDENCE_KINDS, LEVEL_NAMES } from './rpl';
import { CREDIT_HOURS, ITEM_KINDS, NQF_BY_LEVEL } from './credits';
import { Bench, IndicativeNote, KIND_ICON, NotAuthority, NqfBadge, useCredits, type Row } from './ui';
import { BalanceCertsTab } from './fs91public'; // FS78/FS79 (fsIe1)

const NQF_URL = 'https://uaelegislation.gov.ae/en/legislations/2615/download';
const WAM_URL = 'https://www.wam.ae/en/article/c12hbfm-national-qualifications-centre-discusses';

export default function RecognitionPage() {
  const t = useT();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'nqf' ? 'nqf' : sp.get('tab') === 'balance' ? 'balance' : 'rpl'; // FS78/FS79 (fsIe1): third tab
  return (
    <Page title={t('m34.routes.recognition.title')} eyebrow={t('m34.pub.eyebrow')} intro={t('m34.pub.intro')} wide>
      <Bench />
      <NotAuthority />
      <Tabs value={tab} onChange={(id) => setSp(id === 'rpl' ? {} : { tab: id }, { replace: true })} tabs={[
        { id: 'rpl', label: t('m34.pub.tabRpl'), content: <RplTab /> },
        { id: 'nqf', label: t('m34.pub.tabNqf'), content: <NqfTab /> },
        { id: 'balance', label: t('m34.pub.tabBalance'), content: <BalanceCertsTab /> }, // FS78/FS79 (fsIe1)
      ]} />
    </Page>
  );
}

function RplTab() {
  const t = useT();
  const s = useSession();
  const steps = ['request', 'evidence', 'assess', 'credit'];
  return (
    <div className="space-y-6" data-testid="m34-pub-rpl">
      <Section title={t('m34.pub.flowTitle')} description={t('m34.pub.flowDesc')}>
        <Stepper steps={steps.map((x) => ({ id: x, label: t(`m34.pub.step.${x}`) }))} current={-1} />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((x, i) => <Card key={x} eyebrow={`${i + 1}`} title={t(`m34.pub.step.${x}`)}><p className="text-[13px] text-ink-2">{t(`m34.pub.stepBody.${x}`)}</p></Card>)}
        </div>
      </Section>
      <Section title={t('m34.pub.evTitle')} description={t('m34.pub.evDesc')}>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="m34-pub-kinds">
          {EVIDENCE_KINDS.map((k) => (
            <li key={k} className="card flex gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken" aria-hidden><Icon name={KIND_ICON[k]} /></span>
              <div><div className="font-semibold">{t(`m34.kind.${k}`)}</div><p className="text-[13px] text-ink-2">{t(`m34.pub.kindBody.${k}`)}</p></div>
            </li>
          ))}
          <li className="card flex gap-3 border-dashed p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken" aria-hidden><Icon name="lock" /></span>
            <div><div className="font-semibold">{t('m34.pub.neverTitle')}</div><p className="text-[13px] text-ink-2">{t('m34.pub.neverBody')}</p></div>
          </li>
        </ul>
      </Section>
      <Section title={t('m34.pub.outTitle')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {['full', 'partial', 'not_yet'].map((o) => <Card key={o} title={<StatusPill tone={o === 'full' ? 'ok' : o === 'partial' ? 'info' : 'sim'}>{t(`m34.outcome.${o}`)}</StatusPill>}><p className="text-[13px] text-ink-2">{t(`m34.pub.outBody.${o}`)}</p></Card>)}
        </div>
        <p className="mt-3 text-[13px] text-ink-2">{t('m34.pub.twoPeople')}</p>
        <p className="mt-1 text-[13px] text-ink-2">{t('m34.pub.export')} <SourceLink href={WAM_URL} date="2026-10-10">{t('m34.pub.nqcSource')}</SourceLink></p>
      </Section>
      <Card title={t('m34.pub.ctaTitle')}>
        <p className="text-[13px] text-ink-2">{t(s.identity.personId ? 'm34.pub.ctaSigned' : 'm34.pub.ctaAnon')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <L to="/my/recognition" className="btn-primary btn-sm">{t('m34.pub.ctaStart')}</L>
          <L to="/my/credits" className="btn-outline btn-sm">{t('m34.pub.ctaCredits')}</L>
        </div>
      </Card>
    </div>
  );
}

function NqfTab() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const credits = useCredits();
  const repo = useRepo();
  const q = useQuery(['credit_tags', 'credit_stacks', 'scale_maps'], async () => {
    const [tags, stacks, maps] = await Promise.all([
      repo.list('credit_tags', {}).catch(() => []) as Promise<Row[]>,
      repo.list('credit_stacks', { order: [['sort', 'asc']] }).catch(() => []) as Promise<Row[]>,
      repo.list('scale_maps', { filter: { framework: 'uae_nqf' } }).catch(() => []) as Promise<Row[]>,
    ]);
    return { tags: tags.filter((x) => x.status === 'published'), stacks, maps };
  }, []);
  const [flt, setFlt] = useFilters({ q: '', kind: '', nqf: '' }, true);
  return (
    <div className="space-y-6" data-testid="m34-pub-nqf">
      <IndicativeNote />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title={t('m34.pub.ruleTitle')}>
          <p className="text-[28px] font-semibold"><bdi dir="ltr" className="num">1</bdi> {t('m34.pub.ruleCredit')} = <bdi dir="ltr" className="num">{f.num(CREDIT_HOURS)}</bdi> {t('m34.pub.ruleHours')}</p>
          <p className="text-[13px] text-ink-2">{t('m34.pub.ruleBody')}</p>
        </Card>
        <Card title={t('m34.pub.mapTitle')}>
          <Async state={q}>{(d) => (
            <table className="w-full text-[13px]" data-testid="m34-pub-map">
              <thead><tr className="text-start text-ink-3"><th className="py-1 text-start font-normal">{t('m34.pub.mapKafaa')}</th><th className="py-1 text-start font-normal">{t('m34.pub.mapNqf')}</th></tr></thead>
              <tbody>
                {[1, 2, 3, 4].map((l) => {
                  const m = d.maps.find((x) => x.band === `l${l}`);
                  return (
                    <tr key={l} className="border-t border-line">
                      <td className="py-1.5">{t('m34.ui.levelN', { n: f.num(l), name: lang === 'ar' ? LEVEL_NAMES[l].ar : LEVEL_NAMES[l].en })}</td>
                      <td className="py-1.5">{m ? pick(m, 'label') : '—'} <span className="text-[12px] text-ink-3">· {t('m34.pub.mapUsed', { n: f.num(NQF_BY_LEVEL[l]) })}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}</Async>
          <p className="mt-2 text-[12px] text-ink-3">{t('m34.pub.mapNote')} <SourceLink href={NQF_URL} date="2026-10-10">{t('m34.pub.nqfSource')}</SourceLink></p>
        </Card>
      </div>
      <Async state={q}>{(d) => (
        <>
          <Section title={t('m34.pub.stacksTitle')} description={t('m34.pub.stacksDesc')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="m34-pub-stacks">
              {d.stacks.map((st) => (
                <Card key={st.id} title={pick(st, 'title')} eyebrow={t('m34.cr.stackEyebrow', { n: f.num(st.credits_required) })}>
                  <p className="text-[13px] text-ink-2">{pick(st, 'summary')}</p>
                  <p className="mt-2 text-[13px] font-semibold">{pick(st, 'award')}</p>
                  <p className="text-[12px] text-ink-3">{pick(st, 'partner')} · <NqfBadge level={st.nqf_level} /> · {t('m34.pub.rplCap', { n: f.num(st.rpl_max) })}</p>
                  <p className="mt-1 text-[12px] text-ink-3">{t('m34.pub.stackItems', { n: f.num(d.tags.filter((x) => (x.stack_ids ?? []).includes(st.id)).length) })}</p>
                </Card>
              ))}
            </div>
          </Section>
          <Section title={t('m34.pub.catTitle')} description={t('m34.pub.catDesc')}>
            <FilterBar value={flt} onChange={setFlt} search="q" fields={[
              { key: 'kind', label: t('m34.cr.colKind'), options: ITEM_KINDS.map((k) => ({ value: k, label: t(`m34.item.${k}`) })) },
              { key: 'nqf', label: t('m34.cr.colNqf'), options: [...new Set(d.tags.map((x) => Number(x.nqf_level)))].sort((a, b) => a - b).map((n) => ({ value: String(n), label: t('m34.tags.nqfN', { n: f.num(n) }) })) },
            ]} />
            {(() => {
              const term = flt.q.trim().toLowerCase();
              const rows = d.tags.filter((x) => (!flt.kind || x.item_kind === flt.kind) && (!flt.nqf || String(x.nqf_level) === flt.nqf) && (!term || `${x.title_en} ${x.title_ar}`.toLowerCase().includes(term)));
              const cols: Column<Row>[] = [
                { key: 'item', header: t('m34.cr.colItem'), value: (x) => pick(x, 'title'), sortable: true, render: (x) => <span className="font-semibold">{pick(x, 'title')}</span> },
                { key: 'kind', header: t('m34.cr.colKind'), value: (x) => t(`m34.item.${x.item_kind}`) },
                { key: 'nqf', header: t('m34.cr.colNqf'), value: (x) => Number(x.nqf_level), sortable: true, render: (x) => <NqfBadge level={x.nqf_level} /> },
                { key: 'credits', header: t('m34.cr.colCredits'), value: (x) => Number(x.notional_hours) / 10, sortable: true, render: (x) => <span className="num font-semibold">{credits(x.notional_hours)}</span> },
                { key: 'basis', header: t('m34.pub.colBasis'), value: (x) => pick(x, 'basis'), render: (x) => <span className="text-[12px] text-ink-2">{pick(x, 'basis')}</span> },
              ];
              return rows.length ? <div data-testid="m34-pub-catalogue"><DataTable rows={rows} columns={cols} rowKey={(x) => x.id} pageSize={15} caption={t('m34.pub.catTitle')} csvName="kafaa-credit-catalogue.csv" /></div> : <EmptyState title={t('m34.pub.catEmpty')} />;
            })()}
          </Section>
        </>
      )}</Async>
    </div>
  );
}

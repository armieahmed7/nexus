// FS31 /my/skills/credentials/future: future-skills micro-credentials. Eight definitions (AI assurer, data for plant decisions,
// digital twin practitioner, SMR foundations, clean energy systems, cyber hygiene for all staff, questioning in an AI-augmented plant,
// systems thinking), each earned from existing or FS19 content; a strategic tier whose holders are eligible for the named gigs and
// rotations (the IBM pattern). My state comes from F01 evidence (eligibility, TS = SQL). Internal recognition: never a FANR
// certificate, licence or qualification.
import { Page, Async, BenchmarkChips, Callout, Card, Grid, Section, StatTile, EmptyState, WhyThis, Icon } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { McAction } from './MicrocredsPage';
import { AreaChip, McMedal, McStatusPill, ProgressLine, cardState, eligibilityReasons } from './mcUi';
import { FS31_CODES } from './futureCreds';
import { StrategicChip, UnlockLine, useFcData, type FcData } from './fcUi';
import type { DefRow } from './microcred';

export default function FutureCredsPage() {
  const t = useT();
  const s = useSession();
  const q = useFcData(s.identity.personId);
  return (
    <Page title={t('m17.routes.my-skills-credentials-future.title')} eyebrow={<BenchmarkChips feature="FS31" />} intro={t('m17.fc.intro')} wide
      actions={<div className="flex flex-wrap gap-2"><L to="/my/skills/credentials" className="btn-outline btn-sm no-underline">{t('m17.fc.toAll')}</L><L to="/my/skills/record" className="btn-ghost btn-sm no-underline">{t('m17.fc.toRecord')}</L></div>}>
      <Callout tone="sim" title={t('m17.mc.noticeTitle')}>{t('m17.mc.notice')}</Callout>
      <Async state={q}>{(d) => <Future d={d} />}</Async>
    </Page>
  );
}

function Future({ d }: { d: FcData }) {
  const t = useT();
  const f = useFormat();
  const defs = FS31_CODES.map((c) => d.defs.find((x) => x.code === c && x.status === 'current')).filter(Boolean) as DefRow[];
  if (!defs.length) return <EmptyState title={t('m17.fc.empty')}>{t('m17.fc.emptyBody')}</EmptyState>;
  const byCode = new Map(d.items.map((e) => [e.code, e]));
  const st = (def: DefRow) => cardState(d, def, byCode.get(def.code));
  const strategic = defs.filter((x) => x.strategic);
  const others = defs.filter((x) => !x.strategic);
  const held = defs.filter((x) => ['active', 'renewal_due'].includes(st(x).status)).length;
  const ready = defs.filter((x) => st(x).status === 'eligible').length;
  const open = d.mine.filter((u) => u.unlocked).length;
  return (
    <div className="space-y-6">
      <Grid cols={4}>
        <StatTile label={t('m17.fc.tile.held')} value={f.num(held)} sub={t('m17.fc.tile.heldSub', { n: f.num(defs.length) })} tone="ok" />
        <StatTile label={t('m17.fc.tile.ready')} value={f.num(ready)} sub={t('m17.fc.tile.readySub')} tone="info" />
        <StatTile label={t('m17.fc.tile.open')} value={f.num(open)} sub={t('m17.fc.tile.openSub', { n: f.num(d.mine.length) })} tone={open ? 'ok' : undefined} />
        <StatTile label={t('m17.fc.tile.strategic')} value={f.num(strategic.length)} sub={t('m17.fc.tile.strategicSub')} />
      </Grid>

      <Section title={t('m17.fc.tierTitle')} description={t('m17.fc.tierBody')}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="m17-fc-tier">
          {strategic.map((def) => <FcCard key={def.code} d={d} def={def} big />)}
        </div>
      </Section>

      <Section title={t('m17.fc.moreTitle')} description={t('m17.fc.moreBody')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m17-fc-more">
          {others.map((def) => <FcCard key={def.code} d={d} def={def} />)}
        </div>
      </Section>

      <Card title={t('m17.fc.gigsTitle')} eyebrow={t('m17.fc.gigsEyebrow')}>
        {d.mine.length ? <ul className="space-y-1.5" data-testid="m17-fc-gigs">{d.mine.map((u) => <UnlockLine key={u.id} u={u} />)}</ul> : <p className="text-[13px] text-ink-3">{t('m17.fc.gigsNone')}</p>}
        <p className="mt-2 text-[12px] text-ink-3">{t('m17.fc.gigsNote')}</p>
      </Card>
    </div>
  );
}

function FcCard({ d, def, big }: { d: FcData; def: DefRow; big?: boolean }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const e = d.items.find((x) => x.code === def.code);
  const st = cardState(d, def, e);
  const unl = d.mine.filter((u) => u.def_code === def.code);
  return (
    <Card className={`h-full ${big ? 'border-accent/40' : ''}`}>
      <div className="flex h-full flex-col gap-3" data-testid="m17-fc-card" data-code={def.code} data-status={st.status} data-strategic={def.strategic ? 'yes' : 'no'}>
        <div className="flex items-start gap-3">
          <McMedal code={def.code} status={st.status} size={big ? 64 : 52} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5"><AreaChip area={def.area} />{def.strategic && <StrategicChip />}</div>
            <L to={`/my/skills/credentials/c/${def.code}`} className="mt-1 block text-[15px] font-semibold leading-snug" data-testid="m17-fc-open">{pick(def, 'title')}</L>
            <div className="mt-1 flex flex-wrap items-center gap-1.5"><McStatusPill status={st.status} />{def.version > 1 && <span className="text-[11.5px] text-ink-3">v{f.num(def.version)}</span>}</div>
          </div>
        </div>
        <p className="text-[13px] text-ink-2">{pick(def, 'summary')}</p>
        {e && <ProgressLine e={e} />}
        {unl.length > 0 && (
          <p className="text-[12.5px] text-ink-2"><Icon name={unl.some((u) => u.unlocked) ? 'check' : 'lock'} size={12} className="inline" /> {t('m17.fc.namesN', { n: f.num(unl.length), open: f.num(unl.filter((u) => u.unlocked).length) })}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {e ? <WhyThis reasons={eligibilityReasons(e, (c) => ({ en: c.label_en, ar: c.label_ar }))} testId="m17-fc-card-why" /> : <span />}
          <div className="flex flex-wrap gap-1.5">
            <L to={`/my/skills/credentials/c/${def.code}`} className="btn-ghost btn-sm no-underline">{t('m17.fc.details')}</L>
            <McAction def={def} e={e} st={st} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// FS31 /my/skills/credentials/c/:code: one micro-credential. Criteria with my evidence (<WhyThis>), how each criterion can be met
// (existing or FS19 content), "Where this credential takes you" (roles, gigs and rotations that ask for it, open or locked for me),
// the strategic tier, versions, and my signed award. Internal recognition: never a FANR certificate, licence or qualification.
import { useParams } from 'react-router-dom';
import { Page, Async, BenchmarkChips, Callout, Card, EmptyState, KeyValue, WhyThis, Icon, downloadText } from '../../ui';
import { useT, usePick, useFormat, L } from '../../i18n';
import { useSession } from '../../auth/session';
import { verifyCredential } from './issuer';
import { SignatureChip, shareUrl } from './WalletPage';
import { McAction } from './MicrocredsPage';
import { AreaChip, CriteriaList, McMedal, McStatusPill, ProgressLine, cardState, eligibilityReasons } from './mcUi';
import { HowToEarn, StrategicChip, TakesYou, useFcData, type FcData } from './fcUi';
import { CecCitations } from '../m32/links'; // FS wave E integration (FS41 -> FS31: criteria cite CleanEnergyComp competences)

export default function CredentialPage() {
  const t = useT();
  const s = useSession();
  const { code = '' } = useParams();
  const q = useFcData(s.identity.personId);
  return (
    <Page title={t('m17.routes.my-credential.title')} eyebrow={<BenchmarkChips feature="FS31" />} wide
      actions={<div className="flex flex-wrap gap-2"><L to="/my/skills/credentials/future" className="btn-outline btn-sm no-underline">{t('m17.fc.toFuture')}</L><L to="/my/skills/credentials" className="btn-ghost btn-sm no-underline">{t('m17.fc.toAll')}</L></div>}>
      <Async state={q}>{(d) => <One d={d} code={code.toUpperCase()} />}</Async>
    </Page>
  );
}

function One({ d, code }: { d: FcData; code: string }) {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const def = d.defs.find((x) => x.code === code && x.status === 'current');
  if (!def) return <EmptyState title={t('m17.fc.notFound')}>{t('m17.fc.notFoundBody')}</EmptyState>;
  const e = d.items.find((x) => x.code === def.code);
  const st = cardState(d, def, e);
  const versions = d.defs.filter((x) => x.code === def.code).sort((a, b) => b.version - a.version);
  const award = st.award && st.award.status !== 'pending_approval' ? st.award : null;
  const cred = award?.credential as Record<string, unknown> | undefined;
  const check = cred && Object.keys(cred).length ? verifyCredential(cred) : null;
  return (
    <div className="space-y-5" data-testid="m17-fc-one" data-code={def.code} data-status={st.status}>
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <McMedal code={def.code} status={st.status} size={84} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5"><AreaChip area={def.area} />{def.strategic && <StrategicChip />}<span className="chip border-line text-ink-2"><span className="num">{def.code}</span>&nbsp;v{f.num(def.version)}</span><span className="chip border-line text-ink-2">{t(`m17.mc.level.${def.level}`)}</span></div>
            <h2 className="text-[22px] font-semibold leading-tight">{pick(def, 'title')}</h2>
            <p className="text-[14px] text-ink-2">{pick(def, 'summary')}</p>
            <div className="flex flex-wrap items-center gap-2"><McStatusPill status={st.status} /><McAction def={def} e={e} st={st} /></div>
            {e && <div className="max-w-md"><ProgressLine e={e} /></div>}
          </div>
        </div>
      </Card>

      {def.strategic && (
        <Callout tone="info" title={t('m17.fc.tierCalloutTitle')}>
          {t('m17.fc.tierCallout')}{def.strategic_since ? ` ${t('m17.fc.tierSince', { date: f.date(def.strategic_since) })}` : ''}
          {def.strategic_note && <span className="mt-1 block text-[12.5px] italic">“{def.strategic_note}”</span>}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m17.mc.criteriaTitle')}>
          {e ? <CriteriaList e={e} def={def} /> : <p className="text-[13px] text-ink-3">{t('m17.mc.noEligibility')}</p>}
          {e && <div className="mt-2"><WhyThis reasons={eligibilityReasons(e, (c) => ({ en: c.label_en, ar: c.label_ar }))} testId="m17-fc-one-why" /></div>}
        </Card>
        <Card title={t('m17.fc.howTitle')} eyebrow={t('m17.fc.howEyebrow')}>
          <HowToEarn d={d} def={def} />
        </Card>
      </div>
      <CecCitations criteria={(def.criteria ?? []) as never} />

      <Card title={t('m17.fc.takes.title')} eyebrow={t('m17.fc.takes.eyebrow')}>
        <TakesYou d={d} def={def} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t('m17.fc.detailsTitle')}>
          <KeyValue items={[
            [t('m17.mc.validity'), t('m17.mc.months', { n: f.num(def.validity_months) })],
            [t('m17.mc.hours'), def.hours ? t('m17.mc.hoursN', { n: f.num(def.hours) }) : '—'],
            [t('m17.mc.effective'), def.effective_date ? f.date(def.effective_date) : '—'],
            ...(award ? [[t('m17.badge.issued'), award.issued_on ? f.date(award.issued_on) : '—'] as [string, string], [t('m17.badge.validTo'), award.valid_to ? f.date(award.valid_to) : '—'] as [string, string]] : []),
          ]} />
          {versions.length > 1 && (
            <div className="mt-3">
              <h3 className="caps mb-1.5">{t('m17.mc.versions')}</h3>
              <ul className="space-y-1 text-[12.5px] text-ink-2" data-testid="m17-fc-versions">{versions.map((v) => <li key={v.id}>v{f.num(v.version)} · {t(`m17.mc.defStatus.${v.status}`)}{v.effective_date ? ` · ${f.date(v.effective_date)}` : ''}{v.change_reason ? ` · ${v.change_reason}` : ''}</li>)}</ul>
            </div>
          )}
        </Card>
        <Card title={t('m17.mc.credentialTitle')}>
          {award && cred && check ? (
            <div className="space-y-2" data-testid="m17-fc-credential" data-sig={check.outcome}>
              <SignatureChip outcome={check.outcome} keyId={check.keyId} />
              <div className="flex flex-wrap gap-2">
                {award.public_slug && <a className="btn-outline btn-sm" href={shareUrl(award.public_slug)} target="_blank" rel="noopener noreferrer"><Icon name="external" size={12} /> {t('m17.mc.verifyLink')}</a>}
                <button type="button" className="btn-outline btn-sm" onClick={() => downloadText(`${def.code.toLowerCase()}-${award.public_slug}.json`, JSON.stringify(cred, null, 2), 'application/json')}><Icon name="download" size={12} /> {t('m17.badge.download')}</button>
                <L to="/my/skills/record" className="btn-ghost btn-sm no-underline">{t('m17.fc.addToRecord')}</L>
              </div>
            </div>
          ) : <p className="text-[13px] text-ink-3">{t('m17.fc.noAward')}</p>}
        </Card>
      </div>
      <p className="text-[12px] text-ink-3">{t('m17.mc.notice')}</p>
    </div>
  );
}

// M12 · Help centre: public sources cited by the guides and the glossary. Every URL here was opened and read on READ_ON
// (official bodies and standards organisations only); as_of is that reading date, as elsewhere in Kafa'a.
import type { HelpSource } from './types';

export const READ_ON = '2026-10-17';
const src = (title: string, url: string): HelpSource => ({ title, url, as_of: READ_ON });
const unevoc = (label: string, path: string) => src(`UNESCO-UNEVOC TVETipedia glossary · ${label}`, `https://connect.unevoc.unesco.org/home/TVETipedia+Glossary/${path}`);

export const SRC = {
  sfiaLevels: src('SFIA Foundation · SFIA 9 levels of responsibility', 'https://sfia-online.org/en/sfia-9/responsibilities'),
  escoWhat: src('European Commission · What is ESCO?', 'https://esco.ec.europa.eu/en/about-esco/what-esco'),
  escoSkills: src('European Commission · ESCO skills and competences', 'https://esco.ec.europa.eu/en/classification/skill_main'),
  onet: src('O*NET Resource Center · About O*NET', 'https://www.onetcenter.org/overview.html'),
  digcomp: src('European Commission JRC · DigComp 3.0', 'https://joint-research-centre.ec.europa.eu/digcomp/digcomp-framework_en'),
  greencomp: src('European Commission JRC · GreenComp', 'https://joint-research-centre.ec.europa.eu/greencomp'),
  wnaSmr: src('World Nuclear Association · Small Modular Reactors', 'https://world-nuclear.org/information-library/nuclear-fuel-cycle/nuclear-power-reactors/small-nuclear-power-reactors'),
  gif: src('Generation IV International Forum (GIF)', 'https://www.gen-4.org/'),
  clr: src('1EdTech · Comprehensive Learner Record Standard', 'https://www.1edtech.org/standards/clr'),
  badges: src('1EdTech · Open Badges', 'https://www.1edtech.org/standards/open-badges'),
  case: src('1EdTech · Competencies and Academic Standards Exchange (CASE)', 'https://www.1edtech.org/standards/case'),
  vc: src('W3C · Verifiable Credentials Data Model v2.0', 'https://www.w3.org/TR/vc-data-model-2.0/'),
  xapi: src('ADL Initiative · xAPI specification', 'https://github.com/adlnet/xAPI-Spec'),
  iso30414: src('ISO/TC 260 · ISO 30414:2025 human capital reporting', 'https://committee.iso.org/sites/tc260/home/news/content-left-area/news-and-updates/iso-30414-2025-strengthening-hum.html'),
  emiratisation: src('UAE Government portal (u.ae) · Emiratisation', 'https://u.ae/en/information-and-services/jobs/training-and-development/emiratisation'),
  jahiz: src("UAE Government portal (u.ae) · 'Jahiz' future government talents", 'https://u.ae/en/information-and-services/jobs/training-and-development/future-skills/jahiz-future-government-talents'),
  pdpl: src('UAE Government portal (u.ae) · Data protection laws', 'https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws'),
  euAiLiteracy: src('European Commission · AI Literacy: questions and answers', 'https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers'),
  nistAiRmf: src('NIST · AI Risk Management Framework', 'https://www.nist.gov/itl/ai-risk-management-framework'),
  nistTwin: src('NIST CSRC glossary · digital twin', 'https://csrc.nist.gov/glossary/term/digital_twin'),
  nrcSafetyCulture: src('U.S. Nuclear Regulatory Commission · Safety culture', 'https://www.nrc.gov/about-nrc/safety-culture.html'),
  fanr: src('Federal Authority for Nuclear Regulation (FANR)', 'https://www.fanr.gov.ae/en'),
  euMicro: src('European Education Area · A European approach to micro-credentials', 'https://education.ec.europa.eu/education-levels/higher-education/micro-credentials'),
  adekNqf: src('ADEK · National Qualification Framework in the Emirates', 'https://adek.gov.ae/Education-System/Higher-Education/National-Qualification-Framework-in-the-Emirates'),
  skillsPassportSg: src('MySkillsFuture · Careers & Skills Passport', 'https://www.myskillsfuture.gov.sg/csp'),
  criticalCore: src('Institute for Adult Learning Singapore · Critical Core Skills profiling in Singapore (research note)', 'https://ial.edu.sg/getmedia/b772c794-80de-4e2f-b4ef-f454ad6ad6f0/Critical-Core-Skills-RN_Final.pdf'),
  iloRpl: src('ILO · From experience to opportunity: recognition of prior learning', 'https://www.ilo.org/publications/experience-opportunity-unlocking-skills-through-recognition-prior-learning'),
  wcag: src('W3C · Web Content Accessibility Guidelines (WCAG) 2.2', 'https://www.w3.org/TR/WCAG22/'),
  uUpskilling: unevoc('Upskilling', 'show=term/lang=en/term=Upskilling'),
  uRetraining: unevoc('Retraining (reskilling)', 'lang=en/show=term/term=Retraining'),
  uCompetency: unevoc('Competency', 'show=term/lang=en/term=Competency'),
  uSkillsVsCompetence: unevoc('Skills vs. Competence', 'show=term/lang=en/term=Skills+vs.+Competence'),
  uRpl: unevoc('Recognition of prior learning', 'show=term/lang=en/term=Recognition+of+prior+learning'),
  uNqf: unevoc('National qualifications framework', 'show=term/lang=en/term=National+qualifications+framework'),
  uTransversal: unevoc('Transversal skills', 'show=term/lang=en/term=Transversal+skills'),
  uPathway: unevoc('Learning pathway', 'show=term/lang=en/term=Learning+pathway'),
  uGreen: unevoc('Green skills', 'show=term/lang=en/term=Green+skills'),
  uCredit: unevoc('Credit', 'show=term/lang=en/term=Credit'),
  uObsolescence: unevoc('Skill obsolescence', 'show=term/lang=en/term=Skill+obsolescence'),
  uValidation: unevoc('Validation of learning outcomes', 'show=term/lang=en/term=Validation+of+learning+outcomes'),
  uOutcomes: unevoc('Learning outcomes', 'show=term/lang=en/term=Learning+outcomes'),
  uDigital: unevoc('Digital skills', 'show=term/lang=en/term=Digital+skills'),
} satisfies Record<string, HelpSource>;

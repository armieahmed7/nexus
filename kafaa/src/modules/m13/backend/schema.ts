// FS76 (fsHe4) M13 tables added after the G5 block in src/data/schema.ts. Merged into SCHEMA through src/data/ext/schema.ts (one line).
//  - dalil_intents: the Dalil future-skills intents (FS76). One governed row per intent: the catalogue text shown on /ask (EN/AR title,
//    summary, examples), the routes the answers cite, https sources and benchmark ids, and whether the AI owner has it switched on.
//    Public read (the /ask page shows the catalogue to everyone); written only by rpc.setDalilIntent (dalil_config A = admin, the AI owner;
//    audited, NEXUS ledger). The change keeps the acting role, time and reason here (no person id in a public table); the person is in
//    the audit trail. The intent definitions live in src/modules/m13/career/futureIntents.ts (seeded from it).
import type { TableDef } from '../../../data/schema';

const PUBLIC = [{ res: 'public_content' }];

export const TABLES_M13: Record<string, TableDef> = {
  dalil_intents: {
    module: 'M13', label: 'Dalil future-skills intent (FS76): catalogue text, cited routes and sources; the AI owner can switch it off',
    cols: {
      id: 'text pk', kind: 'text enum:role_2030|ai_rung|skill_crosswalk|pathway_gap uniq', audience: 'text enum:both|public|personal', feature: 'text',
      title_en: 'text', title_ar: 'text', summary_en: 'text', summary_ar: 'text', examples_en: 'text[] =[]', examples_ar: 'text[] =[]',
      cites: 'text[] =[]', sources: 'json =[]', benchmark_ids: 'text[] =[]', enabled: 'bool =true', changed_role: 'text?', changed_at: 'ts?', change_note: 'text?', sort: 'int =0',
    },
    read: PUBLIC,
    write: { mode: 'rpc', res: 'dalil_config' },
  },
};

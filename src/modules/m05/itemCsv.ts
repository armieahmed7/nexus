/**
 * Item bank CSV export (M05). Exports metadata only: secure item text (stem, options, key, rationale) never leaves the bank.
 * The column list is ITEM_EXPORT_FIELDS (src/domain/learning.ts); tests/unit/m05-assessments.test.ts checks the CSV.
 */
import type { Column } from '../../ui/DataTable';
import type { ItemsRow } from '../../data/types';
import { ITEM_EXPORT_FIELDS } from '../../domain/learning';

export function itemCsvColumns<T extends ItemsRow>(): Column<T>[] {
  return ITEM_EXPORT_FIELDS.map((f) => ({ key: f, header: f, value: (r: T) => (r[f as keyof ItemsRow] as string | number | null | undefined) ?? null }));
}

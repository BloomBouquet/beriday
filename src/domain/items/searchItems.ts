import { ITEMS, type DisposalItem } from './items.js';

function normalizeQuery(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function searchItems(query: string): DisposalItem[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return ITEMS.filter((item) => item.names.some((name) => normalizeQuery(name).includes(normalized) || normalized.includes(normalizeQuery(name))));
}

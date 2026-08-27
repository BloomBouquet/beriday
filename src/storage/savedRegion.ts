export type SavedRegion = {
  regionId: string;
  savedAt: string;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const KEY = 'beriday:saved-region:v1';

function defaultStorage(): StorageLike {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error('LocalStorage is unavailable in this runtime');
  }
  return globalThis.localStorage;
}

export function getSavedRegion(validRegionIds: Set<string>, storage: StorageLike = defaultStorage()): SavedRegion | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('regionId' in parsed) ||
      !('savedAt' in parsed) ||
      typeof parsed.regionId !== 'string' ||
      typeof parsed.savedAt !== 'string' ||
      !validRegionIds.has(parsed.regionId) ||
      Number.isNaN(Date.parse(parsed.savedAt))
    ) {
      storage.removeItem(KEY);
      return null;
    }
    return { regionId: parsed.regionId, savedAt: parsed.savedAt };
  } catch {
    storage.removeItem(KEY);
    return null;
  }
}

export function saveRegion(
  regionId: string,
  validRegionIds: Set<string>,
  storage: StorageLike = defaultStorage(),
  now: Date = new Date(),
): SavedRegion {
  if (!validRegionIds.has(regionId)) throw new Error(`Unknown region id: ${regionId}`);
  const saved = { regionId, savedAt: now.toISOString() };
  storage.setItem(KEY, JSON.stringify(saved));
  return saved;
}

export function clearSavedRegion(storage: StorageLike = defaultStorage()): void {
  storage.removeItem(KEY);
}

import type { OfficialDataBundle } from '../canonical/officialDataBundle.js';
import type { CollectionRule } from '../../domain/waste/types.js';

export type OfficialRuntimeSourceSummary = {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
};

export type OfficialRuntimeRegion = {
  regionId: string;
  sido: string;
  sigungu: string;
  areaName: string;
  shardId: string;
};

export type OfficialRuntimeShardMeta = {
  path: string;
  regionCount: number;
  ruleCount: number;
};

export type OfficialRuntimeManifest = {
  schemaVersion: 1;
  importedAt: string;
  sourceUpdatedAt: string;
  source: OfficialRuntimeSourceSummary;
  regionCount: number;
  ruleCount: number;
  regions: OfficialRuntimeRegion[];
  shards: Record<string, OfficialRuntimeShardMeta>;
};

export type OfficialRuntimeShard = {
  schemaVersion: 1;
  importedAt: string;
  sourceUpdatedAt: string;
  shardId: string;
  regionIds: string[];
  rules: CollectionRule[];
};

export type OfficialRuntimeDataSet = {
  manifest: OfficialRuntimeManifest;
  shards: Record<string, OfficialRuntimeShard>;
};

const SHARD_ID_PATTERN = /^municipality-[0-9a-f]{8}$/;
const WASTE_CATEGORIES = new Set(['general', 'food', 'recycling', 'bulk', 'other']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right)),
  );
}

function invalidManifest(message: string): never {
  throw new Error(`Invalid official runtime manifest: ${message}`);
}

function invalidShard(message: string): never {
  throw new Error(`Invalid official runtime shard: ${message}`);
}

function parseJson(text: string, label: 'manifest' | 'shard'): unknown {
  try {
    return JSON.parse(text);
  } catch {
    if (label === 'manifest') throw new Error('Invalid official runtime manifest JSON');
    throw new Error('Invalid official runtime shard JSON');
  }
}

function makeMunicipalityKey(sido: string, sigungu: string): string {
  return `${sido.trim()}\u001f${sigungu.trim()}`;
}

function makeShardId(sido: string, sigungu: string): string {
  const key = makeMunicipalityKey(sido, sigungu);
  let hash = 0x811c9dc5;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `municipality-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isSafeShardPath(shardId: string, value: unknown): value is string {
  return typeof value === 'string' && value === `shards/${shardId}.json`;
}

function isRuntimeSourceSummary(value: unknown): value is OfficialRuntimeSourceSummary {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.totalRows) &&
    isNonNegativeInteger(value.acceptedRows) &&
    isNonNegativeInteger(value.rejectedRows)
  );
}

function isRuntimeRegion(value: unknown): value is OfficialRuntimeRegion {
  if (!isRecord(value)) return false;
  return (
    typeof value.regionId === 'string' &&
    typeof value.sido === 'string' &&
    typeof value.sigungu === 'string' &&
    typeof value.areaName === 'string' &&
    typeof value.shardId === 'string' &&
    SHARD_ID_PATTERN.test(value.shardId)
  );
}

function isRuntimeShardMeta(shardId: string, value: unknown): value is OfficialRuntimeShardMeta {
  if (!isRecord(value)) return false;
  return (
    isSafeShardPath(shardId, value.path) &&
    isNonNegativeInteger(value.regionCount) &&
    isNonNegativeInteger(value.ruleCount)
  );
}

function isCollectionRule(value: unknown): value is CollectionRule {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.regionId !== 'string') return false;
  if (typeof value.category !== 'string' || !WASTE_CATEGORIES.has(value.category)) return false;
  if (
    !Array.isArray(value.weekdays) ||
    !value.weekdays.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
  ) {
    return false;
  }
  if (
    !Array.isArray(value.timeWindows) ||
    !value.timeWindows.every((window) => (
      isRecord(window) && isNullableString(window.start) && isNullableString(window.end)
    ))
  ) {
    return false;
  }
  if (!isStringArray(value.excludedDates) || !isStringArray(value.instructions)) return false;
  if (value.confidence !== 'verified' && value.confidence !== 'ambiguous') return false;
  if (!isRecord(value.provenance)) return false;

  const provenance = value.provenance;
  return (
    typeof provenance.sourceId === 'string' &&
    typeof provenance.sourceName === 'string' &&
    typeof provenance.sourceUrl === 'string' &&
    isNullableString(provenance.sourceUpdatedAt) &&
    typeof provenance.importedAt === 'string' &&
    isNullableString(provenance.authorityName) &&
    isNullableString(provenance.authorityContact)
  );
}

function sourceSummaryFromBundle(bundle: OfficialDataBundle): OfficialRuntimeSourceSummary {
  const source = bundle.reports?.source;
  if (
    !source ||
    !isNonNegativeInteger(source.totalRows) ||
    !isNonNegativeInteger(source.acceptedRows) ||
    !isNonNegativeInteger(source.rejectedRows)
  ) {
    throw new Error('Canonical source summary is invalid');
  }

  return {
    totalRows: source.totalRows,
    acceptedRows: source.acceptedRows,
    rejectedRows: source.rejectedRows,
  };
}

function serializeRule(rule: CollectionRule): string {
  return JSON.stringify(rule);
}

export function buildOfficialRuntimeData(
  bundle: OfficialDataBundle,
  sourceUpdatedAt: string,
): OfficialRuntimeDataSet {
  if (!sourceUpdatedAt.trim()) throw new Error('sourceUpdatedAt is required for runtime data');

  const source = sourceSummaryFromBundle(bundle);
  const logicalKeyByShardId = new Map<string, string>();
  const shardIdByRegionId = new Map<string, string>();
  const regionsByShardId = new Map<string, OfficialRuntimeRegion[]>();
  const rulesByShardId = new Map<string, CollectionRule[]>();
  const seenRegionIds = new Set<string>();

  for (const region of [...bundle.regions].sort((left, right) => compareText(left.id, right.id))) {
    if (seenRegionIds.has(region.id)) throw new Error(`Duplicate canonical region: ${region.id}`);
    seenRegionIds.add(region.id);

    const logicalKey = makeMunicipalityKey(region.sido, region.sigungu);
    const shardId = makeShardId(region.sido, region.sigungu);
    const existingLogicalKey = logicalKeyByShardId.get(shardId);
    if (existingLogicalKey && existingLogicalKey !== logicalKey) {
      throw new Error(`Runtime shard hash collision: ${shardId}`);
    }
    logicalKeyByShardId.set(shardId, logicalKey);
    shardIdByRegionId.set(region.id, shardId);

    const runtimeRegion: OfficialRuntimeRegion = {
      regionId: region.id,
      sido: region.sido,
      sigungu: region.sigungu,
      areaName: region.areaName,
      shardId,
    };
    const group = regionsByShardId.get(shardId) ?? [];
    group.push(runtimeRegion);
    regionsByShardId.set(shardId, group);
  }

  const seenRuleIds = new Set<string>();
  for (const rule of [...bundle.rules].sort((left, right) => compareText(left.id, right.id))) {
    if (seenRuleIds.has(rule.id)) throw new Error(`Duplicate canonical rule id: ${rule.id}`);
    seenRuleIds.add(rule.id);

    const shardId = shardIdByRegionId.get(rule.regionId);
    if (!shardId) throw new Error(`Canonical rule references unknown region: ${rule.regionId}`);
    const group = rulesByShardId.get(shardId) ?? [];
    group.push(rule);
    rulesByShardId.set(shardId, group);
  }

  const shards: Record<string, OfficialRuntimeShard> = {};
  const shardMetadata: Record<string, OfficialRuntimeShardMeta> = {};

  for (const shardId of [...regionsByShardId.keys()].sort(compareText)) {
    const shardRegions = [...(regionsByShardId.get(shardId) ?? [])].sort(
      (left, right) => compareText(left.regionId, right.regionId),
    );
    const shardRules = [...(rulesByShardId.get(shardId) ?? [])].sort(
      (left, right) => compareText(left.id, right.id),
    );

    shards[shardId] = {
      schemaVersion: 1,
      importedAt: bundle.importedAt,
      sourceUpdatedAt,
      shardId,
      regionIds: shardRegions.map((region) => region.regionId),
      rules: shardRules,
    };
    shardMetadata[shardId] = {
      path: `shards/${shardId}.json`,
      regionCount: shardRegions.length,
      ruleCount: shardRules.length,
    };
  }

  return {
    manifest: {
      schemaVersion: 1,
      importedAt: bundle.importedAt,
      sourceUpdatedAt,
      source,
      regionCount: bundle.regions.length,
      ruleCount: bundle.rules.length,
      regions: [...regionsByShardId.values()]
        .flat()
        .sort((left, right) => compareText(left.regionId, right.regionId)),
      shards: sortRecord(shardMetadata),
    },
    shards: sortRecord(shards),
  };
}

export function serializeOfficialRuntimeManifest(manifest: OfficialRuntimeManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function serializeOfficialRuntimeShard(shard: OfficialRuntimeShard): string {
  return `${JSON.stringify(shard, null, 2)}\n`;
}

export function loadOfficialRuntimeManifest(text: string): OfficialRuntimeManifest {
  const parsed = parseJson(text, 'manifest');
  if (!isRecord(parsed)) invalidManifest('root must be an object');
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported official runtime manifest schema version: ${String(parsed.schemaVersion)}`);
  }
  if (typeof parsed.importedAt !== 'string') invalidManifest('importedAt must be a string');
  if (typeof parsed.sourceUpdatedAt !== 'string') invalidManifest('sourceUpdatedAt must be a string');
  if (!isRuntimeSourceSummary(parsed.source)) invalidManifest('source summary is invalid');
  if (!isNonNegativeInteger(parsed.regionCount)) invalidManifest('regionCount must be a non-negative integer');
  if (!isNonNegativeInteger(parsed.ruleCount)) invalidManifest('ruleCount must be a non-negative integer');
  if (!Array.isArray(parsed.regions) || !parsed.regions.every(isRuntimeRegion)) {
    invalidManifest('regions must be a valid array');
  }
  if (!isRecord(parsed.shards)) invalidManifest('shards must be an object');

  const seenRegionIds = new Set<string>();
  for (const region of parsed.regions) {
    if (seenRegionIds.has(region.regionId)) invalidManifest(`duplicate regionId: ${region.regionId}`);
    seenRegionIds.add(region.regionId);
  }

  for (const [shardId, metadata] of Object.entries(parsed.shards)) {
    if (!SHARD_ID_PATTERN.test(shardId)) invalidManifest(`invalid shard id: ${shardId}`);
    if (!isRuntimeShardMeta(shardId, metadata)) invalidManifest(`invalid shard metadata: ${shardId}`);
  }

  return parsed as OfficialRuntimeManifest;
}

export function loadOfficialRuntimeShard(text: string): OfficialRuntimeShard {
  const parsed = parseJson(text, 'shard');
  if (!isRecord(parsed)) invalidShard('root must be an object');
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported official runtime shard schema version: ${String(parsed.schemaVersion)}`);
  }
  if (typeof parsed.importedAt !== 'string') invalidShard('importedAt must be a string');
  if (typeof parsed.sourceUpdatedAt !== 'string') invalidShard('sourceUpdatedAt must be a string');
  if (typeof parsed.shardId !== 'string' || !SHARD_ID_PATTERN.test(parsed.shardId)) {
    invalidShard('shardId is invalid');
  }
  if (!isStringArray(parsed.regionIds)) invalidShard('regionIds must be a string array');
  if (!Array.isArray(parsed.rules) || !parsed.rules.every(isCollectionRule)) {
    invalidShard('rules must be a valid collection rule array');
  }

  if (new Set(parsed.regionIds).size !== parsed.regionIds.length) {
    invalidShard('regionIds must not contain duplicates');
  }
  const seenRuleIds = new Set<string>();
  for (const rule of parsed.rules) {
    if (seenRuleIds.has(rule.id)) invalidShard(`duplicate rule id: ${rule.id}`);
    seenRuleIds.add(rule.id);
  }

  return parsed as OfficialRuntimeShard;
}

export function verifyOfficialRuntimeData(
  bundle: OfficialDataBundle,
  sourceUpdatedAt: string,
  runtime: OfficialRuntimeDataSet,
): void {
  const { manifest, shards } = runtime;
  const expectedSource = sourceSummaryFromBundle(bundle);

  if (manifest.importedAt !== bundle.importedAt) {
    throw new Error('Runtime manifest importedAt does not match canonical data');
  }
  if (manifest.sourceUpdatedAt !== sourceUpdatedAt) {
    throw new Error('Runtime manifest sourceUpdatedAt does not match validation report');
  }
  if (JSON.stringify(manifest.source) !== JSON.stringify(expectedSource)) {
    throw new Error('Runtime source summary does not match canonical data');
  }
  if (manifest.regionCount !== bundle.regions.length) {
    throw new Error('Runtime manifest region count does not match canonical data');
  }
  if (manifest.ruleCount !== bundle.rules.length) {
    throw new Error('Runtime manifest rule count does not match canonical data');
  }
  if (manifest.regions.length !== bundle.regions.length) {
    throw new Error('Runtime region membership does not match canonical data');
  }

  const canonicalRegionById = new Map(bundle.regions.map((region) => [region.id, region]));
  const seenManifestRegions = new Set<string>();
  const manifestRegionIdsByShard = new Map<string, string[]>();

  for (const entry of manifest.regions) {
    if (seenManifestRegions.has(entry.regionId)) {
      throw new Error(`Duplicate runtime manifest region: ${entry.regionId}`);
    }
    seenManifestRegions.add(entry.regionId);

    const canonical = canonicalRegionById.get(entry.regionId);
    if (!canonical) throw new Error(`Runtime manifest contains unknown region: ${entry.regionId}`);
    if (
      canonical.sido !== entry.sido ||
      canonical.sigungu !== entry.sigungu ||
      canonical.areaName !== entry.areaName
    ) {
      throw new Error(`Runtime manifest region metadata does not match canonical data: ${entry.regionId}`);
    }

    const expectedShardId = makeShardId(canonical.sido, canonical.sigungu);
    if (entry.shardId !== expectedShardId) {
      throw new Error(`Runtime manifest region has invalid shard assignment: ${entry.regionId}`);
    }
    if (!manifest.shards[entry.shardId]) {
      throw new Error(`Runtime manifest region references unknown shard: ${entry.shardId}`);
    }

    const regionIds = manifestRegionIdsByShard.get(entry.shardId) ?? [];
    regionIds.push(entry.regionId);
    manifestRegionIdsByShard.set(entry.shardId, regionIds);
  }

  for (const region of bundle.regions) {
    if (!seenManifestRegions.has(region.id)) {
      throw new Error(`Runtime region membership is missing canonical region: ${region.id}`);
    }
  }

  const manifestShardIds = Object.keys(manifest.shards).sort(compareText);
  const runtimeShardIds = Object.keys(shards).sort(compareText);
  if (JSON.stringify(manifestShardIds) !== JSON.stringify(runtimeShardIds)) {
    throw new Error('Runtime shard set does not match manifest metadata');
  }

  const runtimeRuleCounts = new Map<string, number>();
  let totalRuntimeRules = 0;

  for (const shardId of manifestShardIds) {
    const metadata = manifest.shards[shardId];
    const shard = shards[shardId];
    if (!shard) throw new Error(`Runtime shard is missing: ${shardId}`);
    if (shard.shardId !== shardId) throw new Error(`Runtime shard id mismatch: ${shardId}`);
    if (shard.importedAt !== manifest.importedAt) {
      throw new Error(`Runtime shard importedAt mismatch: ${shardId}`);
    }
    if (shard.sourceUpdatedAt !== manifest.sourceUpdatedAt) {
      throw new Error(`Runtime shard sourceUpdatedAt mismatch: ${shardId}`);
    }

    const declaredRegionIds = new Set(shard.regionIds);
    for (const rule of shard.rules) {
      if (!declaredRegionIds.has(rule.regionId)) {
        throw new Error(`Runtime shard contains rule outside declared regionIds: ${shardId}`);
      }
      const serialized = serializeRule(rule);
      runtimeRuleCounts.set(serialized, (runtimeRuleCounts.get(serialized) ?? 0) + 1);
      if ((runtimeRuleCounts.get(serialized) ?? 0) > 1) {
        throw new Error(`Duplicate runtime rule membership detected: ${rule.id}`);
      }
    }

    const expectedRegionIds = [...(manifestRegionIdsByShard.get(shardId) ?? [])].sort(compareText);
    const actualRegionIds = [...shard.regionIds].sort(compareText);
    if (JSON.stringify(expectedRegionIds) !== JSON.stringify(actualRegionIds)) {
      throw new Error(`Runtime shard region membership does not match manifest: ${shardId}`);
    }
    if (metadata.regionCount !== shard.regionIds.length) {
      throw new Error(`Runtime shard region metadata count mismatch: ${shardId}`);
    }
    if (metadata.ruleCount !== shard.rules.length) {
      throw new Error(`Runtime shard rule metadata count mismatch: ${shardId}`);
    }

    totalRuntimeRules += shard.rules.length;
  }

  if (totalRuntimeRules !== bundle.rules.length) {
    throw new Error('Runtime rule membership count does not match canonical data');
  }

  const canonicalRuleCounts = new Map<string, number>();
  for (const rule of bundle.rules) {
    const serialized = serializeRule(rule);
    canonicalRuleCounts.set(serialized, (canonicalRuleCounts.get(serialized) ?? 0) + 1);
  }

  if (canonicalRuleCounts.size !== runtimeRuleCounts.size) {
    throw new Error('Runtime rule membership does not match canonical data');
  }
  for (const [serialized, count] of canonicalRuleCounts) {
    if (runtimeRuleCounts.get(serialized) !== count) {
      throw new Error('Runtime rule membership does not match canonical data');
    }
  }
}

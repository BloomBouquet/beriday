import type { CollectionRule, Region } from '../../domain/waste/types.js';
import type { OfficialDataBundle } from './officialDataBundle.js';

export type OfficialRuntimeRegion = Region & {
  shardPath: string;
};

export type OfficialRuntimeManifest = {
  schemaVersion: 1;
  importedAt: string;
  regions: OfficialRuntimeRegion[];
  summary: {
    totalRows: number | null;
    acceptedRows: number | null;
    rejectedRows: number | null;
    coveredRegions: number;
    rules: number;
  };
};

export type OfficialRuntimeShard = {
  schemaVersion: 1;
  importedAt: string;
  regionId: string;
  rules: CollectionRule[];
};

export type OfficialRuntimeShardFile = {
  path: string;
  asset: OfficialRuntimeShard;
};

export type OfficialRuntimeAssets = {
  manifest: OfficialRuntimeManifest;
  shards: OfficialRuntimeShardFile[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function shardKey(regionId: string): string {
  const bytes = new TextEncoder().encode(regionId);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}

function sourceCount(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid official runtime ${label} JSON`);
  }
}

function requireString(record: Record<string, unknown>, field: string, label: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid official runtime ${label}: ${field} must be a non-empty string`);
  }
  return value;
}

function requireNullableCount(record: Record<string, unknown>, field: string): number | null {
  const value = record[field];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid official runtime manifest: summary.${field} must be a non-negative integer or null`);
  }
  return value;
}

function requireCount(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid official runtime manifest: summary.${field} must be a non-negative integer`);
  }
  return value;
}

export function serializeOfficialRuntimeManifest(manifest: OfficialRuntimeManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function serializeOfficialRuntimeShard(shard: OfficialRuntimeShard): string {
  return `${JSON.stringify(shard, null, 2)}\n`;
}

export function loadOfficialRuntimeManifest(text: string): OfficialRuntimeManifest {
  const parsed = parseJson(text, 'manifest');
  if (!isRecord(parsed)) {
    throw new Error('Invalid official runtime manifest: root must be an object');
  }
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported official runtime manifest schemaVersion: ${String(parsed.schemaVersion)}`);
  }

  const importedAt = requireString(parsed, 'importedAt', 'manifest');
  if (!Array.isArray(parsed.regions)) {
    throw new Error('Invalid official runtime manifest: regions must be an array');
  }
  if (!isRecord(parsed.summary)) {
    throw new Error('Invalid official runtime manifest: summary must be an object');
  }

  const regions = parsed.regions.map((value) => {
    if (!isRecord(value)) {
      throw new Error('Invalid official runtime manifest: region must be an object');
    }

    const shardPath = requireString(value, 'shardPath', 'manifest region');
    if (!/^regions\/[A-Za-z0-9_-]+\.json$/u.test(shardPath)) {
      throw new Error(`Invalid official runtime manifest shardPath: ${shardPath}`);
    }

    return {
      id: requireString(value, 'id', 'manifest region'),
      sido: requireString(value, 'sido', 'manifest region'),
      sigungu: requireString(value, 'sigungu', 'manifest region'),
      areaName: requireString(value, 'areaName', 'manifest region'),
      displayName: requireString(value, 'displayName', 'manifest region'),
      shardPath,
    };
  });

  const summary = {
    totalRows: requireNullableCount(parsed.summary, 'totalRows'),
    acceptedRows: requireNullableCount(parsed.summary, 'acceptedRows'),
    rejectedRows: requireNullableCount(parsed.summary, 'rejectedRows'),
    coveredRegions: requireCount(parsed.summary, 'coveredRegions'),
    rules: requireCount(parsed.summary, 'rules'),
  };

  return {
    schemaVersion: 1,
    importedAt,
    regions,
    summary,
  };
}

export function loadOfficialRuntimeShard(text: string, expectedRegionId: string): OfficialRuntimeShard {
  const parsed = parseJson(text, 'shard');
  if (!isRecord(parsed)) {
    throw new Error('Invalid official runtime shard: root must be an object');
  }
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported official runtime shard schemaVersion: ${String(parsed.schemaVersion)}`);
  }

  const importedAt = requireString(parsed, 'importedAt', 'shard');
  const regionId = requireString(parsed, 'regionId', 'shard');
  if (regionId !== expectedRegionId) {
    throw new Error(`Runtime shard region mismatch: expected ${expectedRegionId}, received ${regionId}`);
  }
  if (!Array.isArray(parsed.rules)) {
    throw new Error('Invalid official runtime shard: rules must be an array');
  }

  for (const rule of parsed.rules) {
    if (!isRecord(rule) || typeof rule.regionId !== 'string') {
      throw new Error('Invalid official runtime shard: every rule must contain a regionId');
    }
    if (rule.regionId !== regionId) {
      throw new Error(`Runtime shard rule region mismatch: expected ${regionId}, received ${String(rule.regionId)}`);
    }
  }

  return {
    schemaVersion: 1,
    importedAt,
    regionId,
    rules: parsed.rules as CollectionRule[],
  };
}

export function buildOfficialRuntimeAssets(bundle: OfficialDataBundle): OfficialRuntimeAssets {
  const rulesByRegion = new Map<string, CollectionRule[]>();

  for (const rule of bundle.rules) {
    const rules = rulesByRegion.get(rule.regionId) ?? [];
    rules.push(rule);
    rulesByRegion.set(rule.regionId, rules);
  }

  const sortedRegions = [...bundle.regions].sort((left, right) => compareIds(left.id, right.id));
  const regions: OfficialRuntimeRegion[] = [];
  const shards: OfficialRuntimeShardFile[] = [];

  for (const region of sortedRegions) {
    const path = `regions/${shardKey(region.id)}.json`;
    const rules = [...(rulesByRegion.get(region.id) ?? [])].sort((left, right) => compareIds(left.id, right.id));

    regions.push({ ...region, shardPath: path });
    shards.push({
      path,
      asset: {
        schemaVersion: 1,
        importedAt: bundle.importedAt,
        regionId: region.id,
        rules,
      },
    });
  }

  const uniquePaths = new Set(shards.map((shard) => shard.path));
  if (uniquePaths.size !== shards.length) {
    throw new Error('Runtime shard path collision');
  }

  const source = bundle.reports?.source;

  return {
    manifest: {
      schemaVersion: 1,
      importedAt: bundle.importedAt,
      regions,
      summary: {
        totalRows: sourceCount(source?.totalRows),
        acceptedRows: sourceCount(source?.acceptedRows),
        rejectedRows: sourceCount(source?.rejectedRows),
        coveredRegions: bundle.regions.length,
        rules: bundle.rules.length,
      },
    },
    shards,
  };
}

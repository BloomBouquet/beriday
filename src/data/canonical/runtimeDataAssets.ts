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

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function shardKey(regionId: string): string {
  const bytes = new TextEncoder().encode(regionId);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function sourceCount(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
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

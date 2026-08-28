import type { CollectionRule } from '../../domain/waste/types';
import {
  loadOfficialRuntimeManifest,
  loadOfficialRuntimeShard,
  type OfficialRuntimeManifest,
  type OfficialRuntimeShard,
} from './officialRuntimeData';

const DEFAULT_MANIFEST_URL = '/data/runtime/manifest.json';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type OfficialRuntimeLoaderOptions = {
  manifestUrl?: string;
  fetchImpl?: FetchLike;
};

export type OfficialRuntimeLoader = {
  loadManifest(): Promise<OfficialRuntimeManifest>;
  loadRulesForRegion(regionId: string): Promise<CollectionRule[]>;
};

function resolveManifestOwnedUrl(manifestUrl: string, relativePath: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(manifestUrl)) {
    return new URL(relativePath, manifestUrl).toString();
  }

  const queryIndex = manifestUrl.search(/[?#]/);
  const cleanManifestUrl = queryIndex >= 0 ? manifestUrl.slice(0, queryIndex) : manifestUrl;
  const slashIndex = cleanManifestUrl.lastIndexOf('/');
  if (slashIndex < 0) return relativePath;
  return `${cleanManifestUrl.slice(0, slashIndex + 1)}${relativePath}`;
}

async function fetchText(
  fetchImpl: FetchLike,
  url: string,
  cache: RequestCache,
  label: string,
): Promise<string> {
  const response = await fetchImpl(url, { cache });
  if (!response.ok) {
    throw new Error(`${label} request failed: ${response.status}`);
  }
  return response.text();
}

function verifyLoadedShard(
  manifest: OfficialRuntimeManifest,
  shardId: string,
  shard: OfficialRuntimeShard,
): void {
  const metadata = manifest.shards[shardId];
  if (!metadata) throw new Error(`Official runtime manifest references unknown shard: ${shardId}`);
  if (shard.shardId !== shardId) {
    throw new Error(`Official runtime shard id mismatch: ${shardId}`);
  }
  if (shard.importedAt !== manifest.importedAt) {
    throw new Error(`Official runtime shard importedAt is stale: ${shardId}`);
  }
  if (shard.sourceUpdatedAt !== manifest.sourceUpdatedAt) {
    throw new Error(`Official runtime shard sourceUpdatedAt is stale: ${shardId}`);
  }
  if (shard.regionIds.length !== metadata.regionCount) {
    throw new Error(`Official runtime shard region metadata count mismatch: ${shardId}`);
  }
  if (shard.rules.length !== metadata.ruleCount) {
    throw new Error(`Official runtime shard rule metadata count mismatch: ${shardId}`);
  }

  const expectedRegionIds = manifest.regions
    .filter((region) => region.shardId === shardId)
    .map((region) => region.regionId)
    .sort();
  const actualRegionIds = [...shard.regionIds].sort();
  if (JSON.stringify(expectedRegionIds) !== JSON.stringify(actualRegionIds)) {
    throw new Error(`Official runtime shard region membership mismatch: ${shardId}`);
  }

  const declaredRegionIds = new Set(shard.regionIds);
  for (const rule of shard.rules) {
    if (!declaredRegionIds.has(rule.regionId)) {
      throw new Error(`Official runtime shard contains rule outside declared regions: ${shardId}`);
    }
  }
}

export function createOfficialRuntimeLoader(
  options: OfficialRuntimeLoaderOptions = {},
): OfficialRuntimeLoader {
  const manifestUrl = options.manifestUrl ?? DEFAULT_MANIFEST_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  let manifestPromise: Promise<OfficialRuntimeManifest> | null = null;
  const shardPromises = new Map<string, Promise<OfficialRuntimeShard>>();

  const loadManifest = (): Promise<OfficialRuntimeManifest> => {
    if (!manifestPromise) {
      manifestPromise = fetchText(
        fetchImpl,
        manifestUrl,
        'no-cache',
        'Official runtime manifest',
      )
        .then(loadOfficialRuntimeManifest)
        .catch((error) => {
          manifestPromise = null;
          throw error;
        });
    }
    return manifestPromise;
  };

  const loadShard = async (
    manifest: OfficialRuntimeManifest,
    shardId: string,
  ): Promise<OfficialRuntimeShard> => {
    const cached = shardPromises.get(shardId);
    if (cached) return cached;

    const metadata = manifest.shards[shardId];
    if (!metadata) throw new Error(`Official runtime manifest references unknown shard: ${shardId}`);
    const shardUrl = resolveManifestOwnedUrl(manifestUrl, metadata.path);
    const promise = fetchText(fetchImpl, shardUrl, 'default', 'Official runtime shard')
      .then(loadOfficialRuntimeShard)
      .then((shard) => {
        verifyLoadedShard(manifest, shardId, shard);
        return shard;
      })
      .catch((error) => {
        shardPromises.delete(shardId);
        throw error;
      });

    shardPromises.set(shardId, promise);
    return promise;
  };

  return {
    loadManifest,
    async loadRulesForRegion(regionId: string) {
      const manifest = await loadManifest();
      const region = manifest.regions.find((entry) => entry.regionId === regionId);
      if (!region) throw new Error(`Unknown official runtime region: ${regionId}`);

      const shard = await loadShard(manifest, region.shardId);
      if (!shard.regionIds.includes(regionId)) {
        throw new Error(`Official runtime shard is missing requested region: ${regionId}`);
      }
      return shard.rules;
    },
  };
}

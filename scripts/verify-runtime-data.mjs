import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadOfficialDataAsset } from '../dist-tests/src/data/canonical/officialDataAsset.js';
import {
  loadOfficialRuntimeManifest,
  loadOfficialRuntimeShard,
} from '../dist-tests/src/data/canonical/runtimeDataAssets.js';

const USAGE = 'Usage: node scripts/verify-runtime-data.mjs --canonical <json> --runtime-dir <directory>';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--canonical') options.canonical = value;
    if (flag === '--runtime-dir') options.runtimeDir = value;

    if (flag === '--canonical' || flag === '--runtime-dir') {
      index += 1;
    }
  }

  return options;
}

function fail(message) {
  throw new Error(message);
}

function sortedJson(values) {
  return values.map((value) => JSON.stringify(value)).sort();
}

function assertSameJsonList(actual, expected, message) {
  if (actual.length !== expected.length) fail(message);
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) fail(message);
  }
}

function canonicalRegionView(region) {
  return {
    id: region.id,
    sido: region.sido,
    sigungu: region.sigungu,
    areaName: region.areaName,
    displayName: region.displayName,
  };
}

const options = parseArgs(process.argv.slice(2));

if (!options.canonical || !options.runtimeDir) {
  console.error(USAGE);
  process.exitCode = 1;
} else {
  try {
    const canonicalText = await readFile(options.canonical, 'utf8');
    const canonical = loadOfficialDataAsset(canonicalText);
    const manifestText = await readFile(path.join(options.runtimeDir, 'manifest.json'), 'utf8');
    const manifest = loadOfficialRuntimeManifest(manifestText);

    if (manifest.importedAt !== canonical.importedAt) {
      fail(`Runtime manifest importedAt mismatch: expected ${canonical.importedAt}, received ${manifest.importedAt}`);
    }
    if (manifest.summary.coveredRegions !== canonical.regions.length) {
      fail(`Runtime manifest region count mismatch: expected ${canonical.regions.length}, received ${manifest.summary.coveredRegions}`);
    }
    if (manifest.summary.rules !== canonical.rules.length) {
      fail(`Runtime manifest rule count mismatch: expected ${canonical.rules.length}, received ${manifest.summary.rules}`);
    }
    if (manifest.regions.length !== canonical.regions.length) {
      fail(`Runtime manifest region coverage mismatch: expected ${canonical.regions.length}, received ${manifest.regions.length}`);
    }

    const shardPaths = manifest.regions.map((region) => region.shardPath);
    if (new Set(shardPaths).size !== shardPaths.length) {
      fail('Runtime manifest contains duplicate shard paths');
    }

    const actualRegionFiles = (await readdir(path.join(options.runtimeDir, 'regions'), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => `regions/${entry.name}`)
      .sort();
    const expectedRegionFiles = [...shardPaths].sort();

    if (actualRegionFiles.length !== expectedRegionFiles.length) {
      fail(`Runtime shard file count mismatch: expected ${expectedRegionFiles.length}, received ${actualRegionFiles.length}`);
    }
    assertSameJsonList(
      actualRegionFiles.map((value) => JSON.stringify(value)),
      expectedRegionFiles.map((value) => JSON.stringify(value)),
      'Runtime shard file set mismatch',
    );

    const runtimeRegions = manifest.regions.map(({ shardPath: _shardPath, ...region }) => region);
    assertSameJsonList(
      sortedJson(runtimeRegions),
      sortedJson(canonical.regions.map(canonicalRegionView)),
      'Runtime manifest region metadata mismatch',
    );

    const runtimeRules = [];
    for (const region of manifest.regions) {
      let shardText;
      try {
        shardText = await readFile(path.join(options.runtimeDir, region.shardPath), 'utf8');
      } catch (error) {
        fail(`Cannot read runtime shard ${region.shardPath}: ${error instanceof Error ? error.message : String(error)}`);
      }

      const shard = loadOfficialRuntimeShard(shardText, region.id);
      if (shard.importedAt !== canonical.importedAt) {
        fail(`Runtime shard importedAt mismatch for ${region.id}: expected ${canonical.importedAt}, received ${shard.importedAt}`);
      }
      runtimeRules.push(...shard.rules);
    }

    assertSameJsonList(
      sortedJson(runtimeRules),
      sortedJson(canonical.rules),
      'Runtime shard rule coverage mismatch',
    );

    console.log(JSON.stringify({
      importedAt: manifest.importedAt,
      regions: manifest.regions.length,
      rules: runtimeRules.length,
      shards: expectedRegionFiles.length,
      runtimeDir: options.runtimeDir,
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

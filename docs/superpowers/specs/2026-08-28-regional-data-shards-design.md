# Regional Data Shards Design

## Context

Beriday currently loads `/data/official-data.json` during application startup. The production asset contains the nationwide canonical bundle, including 4,120 selectable regions and 34,090 collection rules. Although HTTP compression makes transfer size acceptable, the browser still downloads, materializes, and parses the full JSON payload before the app can become ready.

The nationwide canonical asset and validation report are valuable audit artifacts and must remain the source of truth. The runtime optimization therefore must not weaken existing validation, provenance, fail-closed behavior, or release verification.

## Goals

- Avoid loading the nationwide rule set during initial application startup.
- Keep the full nationwide canonical asset and validation report unchanged as auditable production source artifacts.
- Preserve the existing `RegionOption`, `CollectionRule`, provenance, confidence, and schedule evaluation semantics.
- Preserve the existing source validation summary shown in the UI without loading the nationwide rule set.
- Allow the region selector to work before any rule shard has been downloaded.
- Fetch only the rule data required for the selected municipality.
- Fail closed if a manifest or shard is malformed, missing, stale, or inconsistent.
- Generate runtime shards deterministically from the verified nationwide asset.
- Verify shard totals and membership against the canonical asset before a release artifact is produced.

## Non-goals

- No backend server or API database.
- No change to official Open API refresh semantics.
- No attempt to reinterpret currently ambiguous official data.
- No redesign of schedule evaluation logic.
- No per-dong file explosion.
- No service worker or offline cache in this iteration.

## Approaches Considered

### 1. Shard by `sido`

Pros: small number of files and simple routing.

Cons: Seoul, Gyeonggi, and other large provinces still contain large rule sets, so parsing cost remains uneven and can still be substantial.

### 2. Shard by individual selectable region

Pros: minimum payload for each selection.

Cons: thousands of files, excessive static asset count, more deployment overhead, and more complex URL/path handling.

### 3. Manifest plus `sido/sigungu` shards — selected

Pros: region catalog remains small enough to load at startup, shard count remains manageable, and each selected municipality receives only its relevant rules.

Cons: one extra fetch after region selection and a new deterministic build/verification step.

This option gives the best balance for the current static Vite deployment.

## Runtime Asset Layout

The canonical source remains:

- `public/data/official-data.json`
- `data/reports/official-data-validation.json`

Generated runtime assets live under:

- `public/data/runtime/manifest.json`
- `public/data/runtime/shards/<encoded-shard-id>.json`

The exact file name is derived deterministically from a stable shard ID rather than using raw Korean path segments directly. `public/data/runtime/` is generated output and is not committed; local development, CI, refresh verification, and production build regenerate it from the canonical pair.

### Manifest

Schema version 1 contains:

- `schemaVersion`
- `importedAt`
- `sourceUpdatedAt`
- `source`: canonical source summary with `totalRows`, `acceptedRows`, and `rejectedRows`
- `regions`: all selectable regions with `regionId`, `sido`, `sigungu`, `areaName`, and `shardId`
- `shards`: metadata keyed by `shardId`, including path, region count, and rule count
- total region and rule counts for cross-checking

The manifest intentionally contains no collection rules. The source summary is limited to the counts already shown by the existing trust UI.

### Shard

Each shard contains:

- `schemaVersion`
- `importedAt`
- `sourceUpdatedAt`
- `shardId`
- `regionIds`
- `rules`

Rules remain in the existing canonical `CollectionRule` shape. A shard contains rules only for region IDs listed by that shard.

## Shard Key

A shard groups regions by `sido + sigungu`. The stable logical shard ID is derived from these normalized values. The runtime filename uses an encoded deterministic representation so file paths remain portable and do not rely on raw user-controlled input.

The client never constructs arbitrary URLs from a selected region. It resolves the selected region to a manifest entry, then resolves `shardId` to the manifest-owned shard path. This prevents path traversal or untrusted URL construction.

## Build Pipeline

A new deterministic runtime-data generator reads the already verified nationwide asset and validation report and writes the manifest plus all municipality shards.

Pipeline order:

1. Verify canonical production asset/report pair.
2. Generate runtime manifest and shards from the canonical bundle and source summary.
3. Verify runtime assets against the canonical bundle and validation report.
4. Run domain/UI/typecheck tests.
5. Build Vite application.
6. Verify generated runtime assets are present in `dist/data/runtime` and match the public runtime source.
7. Upload the release artifact.

The generator must remove stale generated shard files before writing a new set so deleted municipalities cannot survive from an older refresh.

## Runtime Data Loader

A focused data module will expose manifest loading and region-to-shard rule loading. The loader validates schema shape and consistency before returning data.

`OfficialDataApp` changes from one startup fetch into two phases:

1. Fetch and validate `manifest.json`, then render `App` with complete region options, source summary, and no loaded rules.
2. When a region becomes active, fetch its shard and provide only that shard's rules to `App`.

## App Integration

The current `App` owns region selection internally. To avoid loading every shard, it needs a narrow callback interface so the data layer knows which region became active.

Add an optional `onRegionChange(regionId)` callback while keeping existing default behavior and storage semantics. `OfficialDataApp` listens to this callback, resolves the selected region through the manifest, loads the shard, and passes the resulting rules back to `App`.

A saved region can trigger its shard load immediately after the manifest is ready. A new selection triggers a new shard request. If two selections happen quickly, stale fetch results must not replace data for the newest selection.

## Loading and Failure Semantics

Manifest failure:

- Show the existing official-data error state.
- Do not provide region/rule data.

Shard loading:

- Keep region selection visible.
- Treat rules as unavailable until the requested shard is validated.
- The schedule UI must not display stale rules from a previously selected municipality.

Shard failure:

- Fail closed for schedule decisions for that selection.
- Do not fall back to another shard or guess rules.
- The UI may expose a concise data-load failure message while keeping the selector usable.

## Cache Behavior

Use browser HTTP caching for shard files, but preserve update correctness using `importedAt` and `sourceUpdatedAt` consistency checks between manifest and shard. The first implementation does not add application-level persistent caching.

Within one mounted `OfficialDataApp`, successfully loaded shards may be memoized in memory by `shardId` to avoid repeated fetches while switching between regions in the same municipality.

## Validation Invariants

Runtime verification must fail if any of the following is true:

- manifest `importedAt` differs from canonical asset `importedAt`
- manifest `sourceUpdatedAt` or source counts differ from the canonical validation inputs
- manifest region count differs from canonical region count
- manifest rule count differs from canonical rule count
- a canonical region is missing or duplicated in the manifest
- a manifest region references an unknown shard
- a shard contains a rule for a region outside its declared `regionIds`
- a canonical rule is missing or duplicated across shards
- shard total rule count differs from the canonical bundle
- shard metadata count differs from actual shard content
- a shard or manifest has an unsupported schema version

Rule identity comparison must be deterministic and based on the serialized canonical rule content, not object identity.

## Testing Strategy

### Domain/unit

- deterministic shard ID/path generation
- manifest generation from canonical fixture
- source summary preservation
- every region assigned exactly once
- every rule assigned exactly once
- malformed/foreign shard rejection
- stale `importedAt` rejection
- canonical/runtime verification catches missing, duplicate, and cross-shard rules
- stale generated files are removed

### UI

- startup fetch requests manifest only, not nationwide `official-data.json`
- region options render from manifest
- existing source validation summary renders from manifest
- selecting a region requests its declared shard
- switching regions in the same shard reuses loaded data
- switching municipalities requests a different shard
- stale slower fetch cannot overwrite a newer selection
- shard failure does not display rules from the previous selection
- saved region causes the correct shard to load after manifest initialization

### CI/release

- canonical production-data gate remains mandatory
- runtime shard generation and verification run before build
- built `dist/data/runtime` assets are checked against generated public assets
- release metadata continues to record actual checked-out commit SHA and canonical data timestamps/counts

## Migration

The full `public/data/official-data.json` remains committed and refreshed exactly as today. Runtime files are generated deterministically from it and the validation report during local dev/build, refresh verification, and release verification. They are ignored by Git and copied into `dist` by Vite after generation.

No production-data consumer should remove the canonical asset until runtime shard verification has been proven in CI.

## Success Criteria

- Initial app startup does not request `/data/official-data.json`.
- The initial runtime data request contains only the manifest/catalog and source summary, not 34,090 rules.
- Selecting a region loads only one municipality shard.
- Existing schedule results for a given region remain semantically identical to results computed from the nationwide canonical bundle.
- Existing source validation summary remains visible.
- Production refresh, CI, and release remain fail-closed.
- Canonical totals remain 4,120 regions and 34,090 rules for the current data snapshot unless the official source itself changes.

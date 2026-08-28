# Regional Data Shards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Beriday's startup-time nationwide rule load with a deterministic manifest plus municipality shard runtime while preserving the nationwide canonical asset as the audited source of truth.

**Architecture:** Keep `public/data/official-data.json` and its validation report unchanged. Generate `public/data/runtime/manifest.json` plus `public/data/runtime/shards/*.json` from the verified canonical bundle, validate them against canonical region/rule membership, and make `OfficialDataApp` load the manifest first and only the selected municipality shard afterward. `App` continues to own region selection and storage, but exposes the active region through a callback and receives an explicit region-data loading state so stale or missing shards fail closed.

**Tech Stack:** TypeScript 5.9, Node.js 22, React 19, Vite 7, Vitest 3, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-regional-data-shards-design.md`

## Global Constraints

- Keep `public/data/official-data.json` and `data/reports/official-data-validation.json` as the canonical auditable production source.
- Do not add a backend server, database, service worker, or new runtime dependency.
- Do not change schedule evaluation, confidence semantics, provenance shape, or current ambiguous-data policy.
- The browser must never construct shard URLs from user-controlled region strings; paths come only from the validated manifest.
- Runtime generation and verification must be deterministic and fail closed on missing, duplicate, stale, malformed, or cross-shard data.
- Generated `public/data/runtime/` files are build artifacts, not committed source; local dev and production build generate them from the canonical pair.
- Git commit messages remain English.

---

## File Structure

- Create `src/data/runtime/officialRuntimeData.ts`: runtime manifest/shard types, deterministic shard grouping, serialization, parsing, and canonical-vs-runtime verification.
- Create `scripts/build-runtime-data.mjs`: read verified canonical data/report, clear stale runtime files, generate manifest/shards, and write them.
- Create `scripts/verify-runtime-data.mjs`: read runtime files from disk and verify them against the canonical bundle/report.
- Create `tests/unit/officialRuntimeData.test.mjs`: generator/parser/verifier TDD coverage.
- Create `tests/unit/runtimeDataCli.test.mjs`: filesystem/CLI behavior including stale-file cleanup.
- Modify `package.json`: add runtime-data scripts and predev/prebuild generation.
- Modify `.gitignore`: ignore `public/data/runtime/` generated files.
- Create `src/data/runtime/officialRuntimeLoader.ts`: browser fetch/cache layer that loads manifest first and one manifest-owned shard by region.
- Create `tests/ui/OfficialRuntimeLoader.test.ts`: loader validation, cache, and request sequencing coverage.
- Modify `src/App.tsx`: add active-region callback and explicit regional-rule load state without changing selection/storage semantics.
- Modify `src/OfficialDataApp.tsx`: replace nationwide startup fetch with manifest-first + shard-on-selection orchestration.
- Modify `tests/ui/OfficialDataApp.test.tsx`: assert manifest-only startup, lazy shard load, same-shard reuse, fail-closed errors, saved-region load, and stale-response protection.
- Modify `.github/workflows/refresh-official-data.yml`: generate/verify runtime artifacts after canonical verification; keep PR commit scope limited to the canonical data pair.
- Modify `.github/workflows/build-production-release.yml`: generate/verify runtime artifacts before build and verify `dist/data/runtime` matches generated `public/data/runtime`.

---

### Task 1: Pure Runtime Manifest/Shard Contract

**Files:**
- Create: `src/data/runtime/officialRuntimeData.ts`
- Create: `tests/unit/officialRuntimeData.test.mjs`

**Interfaces:**
- Consumes: `OfficialDataBundle`, `Region`, and `CollectionRule` from existing canonical/domain modules.
- Produces:
  - `buildOfficialRuntimeData(bundle: OfficialDataBundle, sourceUpdatedAt: string): OfficialRuntimeDataSet`
  - `serializeOfficialRuntimeManifest(manifest: OfficialRuntimeManifest): string`
  - `serializeOfficialRuntimeShard(shard: OfficialRuntimeShard): string`
  - `loadOfficialRuntimeManifest(text: string): OfficialRuntimeManifest`
  - `loadOfficialRuntimeShard(text: string): OfficialRuntimeShard`
  - `verifyOfficialRuntimeData(bundle: OfficialDataBundle, sourceUpdatedAt: string, runtime: OfficialRuntimeDataSet): void`

- [ ] **Step 1: Write failing generator and verification tests**

Create fixture coverage that proves two regions in the same `sido + sigungu` share one shard while another municipality receives a different shard:

```js
const runtime = buildOfficialRuntimeData(bundle, '2026-07-14');
assert.equal(runtime.manifest.regionCount, 3);
assert.equal(runtime.manifest.ruleCount, 3);
assert.equal(Object.keys(runtime.shards).length, 2);
assert.equal(
  runtime.manifest.regions.find((region) => region.regionId === '광주광역시/북구/일곡동').shardId,
  runtime.manifest.regions.find((region) => region.regionId === '광주광역시/북구/용봉동').shardId,
);
assert.notEqual(
  runtime.manifest.regions.find((region) => region.regionId === '광주광역시/북구/일곡동').shardId,
  runtime.manifest.regions.find((region) => region.regionId === '서울특별시/강남구/역삼동').shardId,
);
assert.doesNotThrow(() => verifyOfficialRuntimeData(bundle, '2026-07-14', runtime));
```

Add mutations that must throw for a missing region, duplicate rule, rule in the wrong shard, stale `importedAt`, unknown shard reference, and changed metadata count.

- [ ] **Step 2: Run the domain test to verify RED**

Run:

```bash
npm run test:domain
```

Expected: FAIL because `officialRuntimeData` exports do not exist.

- [ ] **Step 3: Implement deterministic runtime data types and grouping**

Use these shapes:

```ts
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
```

Generate a stable shard ID from the normalized `sido + "\u001f" + sigungu` key with a deterministic FNV-1a 32-bit hash and prefix it with `municipality-`. Keep a `Map<shardId, logicalKey>` and throw if a hash collision maps two logical keys to the same ID. Store paths only as `shards/${shardId}.json`.

Sort manifest regions by `regionId`, shard `regionIds` lexicographically, shard rules by `id`, and shard metadata keys lexicographically before serialization.

- [ ] **Step 4: Implement strict parsing and canonical verification**

Parsing must reject non-object JSON, unsupported `schemaVersion`, malformed region/shard metadata, and malformed rules. Verification must compare deterministic serialized canonical rule content and require every canonical rule exactly once across shards.

Core membership checks:

```ts
if (manifest.importedAt !== bundle.importedAt) throw new Error('Runtime manifest importedAt does not match canonical data');
if (manifest.sourceUpdatedAt !== sourceUpdatedAt) throw new Error('Runtime manifest sourceUpdatedAt does not match validation report');
if (manifest.regionCount !== bundle.regions.length) throw new Error('Runtime manifest region count does not match canonical data');
if (manifest.ruleCount !== bundle.rules.length) throw new Error('Runtime manifest rule count does not match canonical data');
```

A shard rule must satisfy `shard.regionIds.includes(rule.regionId)`. A manifest region must reference an existing shard whose `regionIds` contains that region ID.

- [ ] **Step 5: Run domain tests to verify GREEN**

Run:

```bash
npm run test:domain
npm run typecheck:domain
```

Expected: all tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/runtime/officialRuntimeData.ts tests/unit/officialRuntimeData.test.mjs
git commit -m "feat: add official runtime shard contract"
```

---

### Task 2: Runtime Data Build and Verify CLIs

**Files:**
- Create: `scripts/build-runtime-data.mjs`
- Create: `scripts/verify-runtime-data.mjs`
- Create: `tests/unit/runtimeDataCli.test.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes Task 1 functions from `dist-tests/src/data/runtime/officialRuntimeData.js` after `npm run build:domain`.
- Produces generated files under `public/data/runtime/` and commands `npm run build:runtime-data`, `npm run verify:runtime-data`.

- [ ] **Step 1: Write failing CLI tests**

Use a temp directory with a minimal canonical asset/report. Assert:

```js
assert.equal(await exists(join(runtimeRoot, 'manifest.json')), true);
assert.equal((await readdir(join(runtimeRoot, 'shards'))).length, 2);
assert.equal(await exists(join(runtimeRoot, 'stale.json')), false);
```

The stale-file case must create `public/data/runtime/stale.json` before invoking the build CLI and prove the generator removes it.

The verify CLI test must corrupt one shard and assert non-zero exit with a concise runtime verification error.

- [ ] **Step 2: Run domain tests to verify RED**

Run:

```bash
npm run test:domain
```

Expected: new CLI tests fail because the scripts do not exist.

- [ ] **Step 3: Implement `build-runtime-data.mjs`**

Behavior:

```js
const assetText = await readFile(assetPath, 'utf8');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const bundle = loadOfficialDataAsset(assetText);
const runtime = buildOfficialRuntimeData(bundle, report.sourceUpdatedAt);
verifyOfficialRuntimeData(bundle, report.sourceUpdatedAt, runtime);
await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(join(runtimeRoot, 'shards'), { recursive: true });
await writeFile(join(runtimeRoot, 'manifest.json'), serializeOfficialRuntimeManifest(runtime.manifest));
for (const [shardId, shard] of Object.entries(runtime.shards)) {
  await writeFile(join(runtimeRoot, 'shards', `${shardId}.json`), serializeOfficialRuntimeShard(shard));
}
```

Default paths:
- asset: `./public/data/official-data.json`
- report: `./data/reports/official-data-validation.json`
- runtime root: `./public/data/runtime`

- [ ] **Step 4: Implement `verify-runtime-data.mjs`**

Load canonical bundle/report and validated `manifest.json`, resolve only manifest-owned relative shard paths under the configured runtime root, reject `..`, absolute paths, or paths outside `shards/`, load every declared shard, then call `verifyOfficialRuntimeData`.

- [ ] **Step 5: Wire package scripts and generated-file ignore**

Add:

```json
{
  "scripts": {
    "build:runtime-data": "npm run build:domain && node scripts/build-runtime-data.mjs",
    "verify:runtime-data": "npm run build:domain && node scripts/verify-runtime-data.mjs",
    "predev": "npm run build:runtime-data",
    "prebuild": "npm run build:runtime-data"
  }
}
```

Append to `.gitignore`:

```gitignore
public/data/runtime/
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:domain
npm run build:runtime-data
npm run verify:runtime-data
npm run typecheck
```

Expected: all commands succeed; `public/data/runtime/manifest.json` and shard files exist locally but remain ignored by Git.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-runtime-data.mjs scripts/verify-runtime-data.mjs tests/unit/runtimeDataCli.test.mjs package.json .gitignore
git commit -m "feat: generate verified runtime data shards"
```

---

### Task 3: Browser Manifest/Shard Loader

**Files:**
- Create: `src/data/runtime/officialRuntimeLoader.ts`
- Create: `tests/ui/OfficialRuntimeLoader.test.ts`

**Interfaces:**
- Consumes Task 1 `loadOfficialRuntimeManifest` and `loadOfficialRuntimeShard`.
- Produces:
  - `createOfficialRuntimeLoader(options?): OfficialRuntimeLoader`
  - `loader.loadManifest(): Promise<OfficialRuntimeManifest>`
  - `loader.loadRulesForRegion(regionId: string): Promise<CollectionRule[]>`

- [ ] **Step 1: Write failing loader tests**

Assert startup manifest fetch uses `/data/runtime/manifest.json`, region lookup resolves path from manifest metadata, same-shard calls reuse one fetch, and malformed/stale shards reject.

Example:

```ts
const loader = createOfficialRuntimeLoader({ fetchImpl });
await loader.loadManifest();
await loader.loadRulesForRegion('광주광역시/북구/일곡동');
await loader.loadRulesForRegion('광주광역시/북구/용봉동');
expect(fetchImpl).toHaveBeenCalledTimes(2); // manifest + one shared shard
```

- [ ] **Step 2: Run UI tests to verify RED**

Run:

```bash
npm test -- tests/ui/OfficialRuntimeLoader.test.ts
```

Expected: FAIL because the loader module does not exist.

- [ ] **Step 3: Implement manifest-owned fetch and in-memory shard cache**

The loader must:
- fetch and validate the manifest once;
- resolve `regionId -> shardId -> manifest.shards[shardId].path`;
- build the request URL relative to the manifest URL, never from `regionId` text;
- validate shard `importedAt`, `sourceUpdatedAt`, `shardId`, region membership, and metadata counts before returning rules;
- cache successful shards by `shardId` for the lifetime of the loader;
- not cache failed requests.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- tests/ui/OfficialRuntimeLoader.test.ts
npm run typecheck:app
```

Expected: loader tests and app typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/runtime/officialRuntimeLoader.ts tests/ui/OfficialRuntimeLoader.test.ts
git commit -m "feat: add lazy official runtime loader"
```

---

### Task 4: App Lazy Municipality Loading

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/OfficialDataApp.tsx`
- Modify: `tests/ui/OfficialDataApp.test.tsx`

**Interfaces:**
- Consumes Task 3 loader.
- `AppProps` gains:
  - `onRegionChange?: (regionId: string | null) => void`
  - `regionDataStatus?: 'idle' | 'loading' | 'ready' | 'error'`
- `OfficialDataApp` supplies region options from the manifest and rules only from the active shard.

- [ ] **Step 1: Rewrite OfficialDataApp tests for manifest-first loading**

Replace the nationwide fixture with separate `manifest` and `shard` JSON fixtures. Assert initial load never requests `/data/official-data.json`:

```ts
await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/data/runtime/manifest.json', expect.anything()));
expect(fetchMock.mock.calls.some(([url]) => String(url).includes('official-data.json'))).toBe(false);
```

Add tests for:
- region selection fetches only its declared shard;
- two regions in the same municipality reuse one shard request;
- selecting another municipality fetches another shard;
- saved region triggers its shard after manifest load;
- shard HTTP/malformed failure displays no schedule result from the previous region;
- a slower previous shard response cannot overwrite the latest region selection.

- [ ] **Step 2: Run UI tests to verify RED**

Run:

```bash
npm test -- tests/ui/OfficialDataApp.test.tsx
```

Expected: failures because current code still fetches `/data/official-data.json` at startup.

- [ ] **Step 3: Add active-region notification and fail-closed rule state to `App`**

Extend props:

```ts
type RegionDataStatus = 'idle' | 'loading' | 'ready' | 'error';

type AppProps = {
  regions?: readonly RegionOption[];
  rules?: readonly CollectionRule[];
  dataSummary?: DataVerificationSummary | null;
  onRegionChange?: (regionId: string | null) => void;
  regionDataStatus?: RegionDataStatus;
};
```

Use `useEffect` to call `onRegionChange(region?.regionId ?? null)` whenever the active region changes. For views that require rules, render a concise loading/error state while `regionDataStatus !== 'ready'`; never render prior rules for a new region.

- [ ] **Step 4: Replace `OfficialDataApp` nationwide state with manifest + active shard state**

Maintain:

```ts
type RuleState =
  | { status: 'idle'; regionId: null; rules: [] }
  | { status: 'loading'; regionId: string; rules: [] }
  | { status: 'ready'; regionId: string; rules: CollectionRule[] }
  | { status: 'error'; regionId: string; rules: [] };
```

Create one loader per mounted app. Load manifest first. On region change, increment a request sequence; only apply the result if its sequence still matches the latest request. Clear rules immediately before a different-region load.

Data summary comes from manifest/canonical validation metadata exposed in the manifest: preserve `importedAt`, and include canonical source totals in the manifest so the existing trust panel can still render `totalRows`, `acceptedRows`, and `rejectedRows` without loading the nationwide bundle.

This requires Task 1 manifest to include:

```ts
source: {
  totalRows: number | null;
  acceptedRows: number | null;
  rejectedRows: number | null;
};
```

Populate these from `bundle.reports.source` and include them in parser/verifier tests.

- [ ] **Step 5: Verify UI behavior**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all UI tests pass; build generates runtime assets before Vite and production startup code points only at the runtime manifest.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/OfficialDataApp.tsx src/data/runtime/officialRuntimeData.ts tests/unit/officialRuntimeData.test.mjs tests/ui/OfficialDataApp.test.tsx
git commit -m "feat: load official rules by municipality"
```

---

### Task 5: Refresh and Release Gates

**Files:**
- Modify: `.github/workflows/refresh-official-data.yml`
- Modify: `.github/workflows/build-production-release.yml`
- Test: existing domain/UI suites plus Actions execution.

**Interfaces:**
- Consumes `npm run build:runtime-data` and `npm run verify:runtime-data` from Task 2.
- Produces CI/release guarantees that runtime shards correspond exactly to the canonical production pair.

- [ ] **Step 1: Add runtime generation/verification to refresh workflow**

After `Verify production data pair`, add:

```yaml
- name: Generate and verify runtime data shards
  run: |
    npm run build:runtime-data
    npm run verify:runtime-data
```

Keep the data PR commit scope unchanged:

```bash
git add public/data/official-data.json data/reports/official-data-validation.json
```

Generated runtime files stay ignored and are not committed.

- [ ] **Step 2: Add runtime gates to release workflow**

After canonical verification add the same generation/verification step. After `npm run build`, extend packaged-data verification:

```bash
test -s dist/data/runtime/manifest.json
cmp public/data/runtime/manifest.json dist/data/runtime/manifest.json
find public/data/runtime/shards -type f -name '*.json' -print0 | sort -z | while IFS= read -r -d '' source; do
  relative="${source#public/}"
  test -s "dist/$relative"
  cmp "$source" "dist/$relative"
done
```

Also compare shard file counts between `public/data/runtime/shards` and `dist/data/runtime/shards`.

- [ ] **Step 3: Run full local-equivalent verification**

Run:

```bash
npm run verify:production-data
npm run build:runtime-data
npm run verify:runtime-data
npm run test:domain
npm test
npm run typecheck
npm run build
npm run verify:runtime-data
```

Expected: every command succeeds.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/refresh-official-data.yml .github/workflows/build-production-release.yml
git commit -m "ci: verify regional runtime data shards"
```

---

### Task 6: Final Review, PR, and Production Verification

**Files:**
- Review all files changed in Tasks 1-5.

**Interfaces:**
- Produces a merge-ready PR and a new release artifact built from the merged main commit.

- [ ] **Step 1: Run complete verification from a clean branch head**

Run:

```bash
npm run verify:production-data
npm run build:runtime-data
npm run verify:runtime-data
npm run test:domain
npm test
npm run typecheck
npm run build
```

Expected: all pass; startup UI tests prove no `/data/official-data.json` fetch.

- [ ] **Step 2: Review diff against the design invariants**

Reject the change if any of these are true: canonical files are removed, shard path is constructed from raw region input, stale rules remain visible during region switches, runtime verification is optional in release, or schedule/provenance semantics change.

- [ ] **Step 3: Open PR using the repository's fixed Korean PR template**

Title:

```text
feat : 지역별 공식 데이터 shard 로딩 추가
```

The PR body must keep the exact required section order: 코드 변경 사항 → 변경 이유 → 구현 방법 → 영향 범위 → 테스트 → 테스트 결과/참고 사항 → 반영 브랜치.

- [ ] **Step 4: Require PR CI GREEN before merge**

Expected gates: Domain tests, UI tests, typecheck, build all success.

- [ ] **Step 5: Merge and verify main CI**

Merge only after the PR is mergeable and all checks pass. Confirm the new main SHA and main CI success.

- [ ] **Step 6: Rebuild production release artifact from new main**

Run/re-run the production release workflow, then verify:
- canonical production gate passed;
- runtime generation/verification passed;
- Domain/UI/typecheck/build passed;
- canonical `official-data.json` byte-match passed;
- runtime manifest and every shard byte-match passed between `public` and `dist`;
- release metadata `commitSha` equals the actual checked-out main commit;
- release artifact upload succeeded.
